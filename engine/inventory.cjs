const fs = require('node:fs');
const path = require('node:path');
const { success, idBytes, withCleanup, closeHandles, throwIfCancelled } = require('./protocol.cjs');

// Read-only inventory of every content meta record on the console, regardless of type.

const STORAGES = { 2: 'Game card', 3: 'System', 4: 'Internal', 5: 'SD' };
const inactive = new Set([0x21005, 0x20a05]);
const CONTENT_TYPES = { 0: 'Meta', 1: 'Program', 2: 'Data', 3: 'Control', 4: 'Manual', 5: 'Legal', 6: 'DeltaFragment' };
const META_TYPES = {
  0x01: 'SystemProgram', 0x02: 'SystemData', 0x03: 'SystemUpdate', 0x04: 'BootImagePackage',
  0x05: 'BootImagePackageSafe', 0x80: 'Application', 0x81: 'Patch', 0x82: 'AddOnContent', 0x83: 'Delta',
  0x84: 'DataPatch',
};

const hex = (value) => value.toString(16).padStart(16, '0');

async function listKeys({ s, database, shouldStop }) {
  const keys = new Map();
  const address = s.base + 0x6000;
  const capacity = 32;
  const size = capacity * 16;

  async function list(min, max) {
    throwIfCancelled(shouldStop);
    const input = Buffer.alloc(32);
    input.writeBigUInt64LE(min, 16);
    input.writeBigUInt64LE(max, 24);

    const reply = success(
      await s.ipc('List installed content', database, 5, input, { receive: [{ address, size, mode: 0 }] }),
      'List installed content',
    );
    const total = reply.data.readInt32LE();
    const count = reply.data.readInt32LE(4);
    const bytes = await s.readOwned(address, size);

    for (let i = 0; i < count; i++) {
      const key = Buffer.from(bytes.subarray(i * 16, (i + 1) * 16));
      keys.set(key.toString('hex'), key);
    }

    if (total <= count || min === max) return;
    const mid = (min + max) / 2n;
    await list(min, mid);
    await list(mid + 1n, max);
  }

  await list(0n, 0xffffffffffffffffn);
  return [...keys.values()];
}

async function readContents({ s, database, key }) {
  const contents = [];
  for (const type of Object.keys(CONTENT_TYPES).map(Number)) {
    const input = Buffer.alloc(24);
    input[0] = type;
    key.copy(input, 8);
    const reply = await s.ipc('Get content information type ' + type, database, 24, input);
    if (reply.result) continue;
    const id = await s.ipc('GetContentIdByType ' + type, database, 3, input);
    contents.push({
      type: CONTENT_TYPES[type],
      id: id.result ? null : Buffer.from(id.data.subarray(0, 16)).toString('hex'),
      size: Number(reply.data.subarray(16, 22).readUIntLE(0, 6)),
    });
  }
  return contents;
}

const related = (game, id) => {
  const prefixes = [game.slice(0, 13)];
  if (game.startsWith('01')) prefixes.push('04' + game.slice(2, 13));
  return prefixes.some((p) => id.startsWith(p));
};

async function listInventory({ s, domain, service, shouldStop = () => false, game, includeSystem = true }) {
  const ncm = await service('ncm');
  const records = [];

  for (const storage of Object.keys(STORAGES).map(Number)) {
    if (storage === 3 && !includeSystem && !game) continue;
    throwIfCancelled(shouldStop);
    let database;
    try {
      await withCleanup(async () => {
        database = domain.oneHandle(
          success(await s.ipc('Open metadata database', ncm, 5, Buffer.from([storage])), 'OpenContentMetaDatabase'),
        );
        for (const key of await listKeys({ s, database, shouldStop })) {
          throwIfCancelled(shouldStop);
          const metaType = key[12];
          const title = hex(key.readBigUInt64LE());
          let owner;
          if (metaType >= 0x81 && metaType <= 0x84) {
            const reply = await s.ipc('Get owner application', database, 22, key);
            if (!reply.result) owner = hex(reply.data.readBigUInt64LE());
          }
          if (game && !related(game, title) && !(owner && related(game, owner))) continue;
          records.push({
            storage: STORAGES[storage],
            title,
            version: key.readUInt32LE(8),
            metaType: META_TYPES[metaType] || 'Unknown(0x' + metaType.toString(16) + ')',
            ...(owner ? { owner } : {}),
            contents: await readContents({ s, database, key }),
          });
        }
      }, () => closeHandles(s, database ? [database] : []));
    } catch (error) {
      if (!inactive.has(error.nativeResult?.canonical)) throw error;
    }
  }

  records.sort((a, b) => a.storage.localeCompare(b.storage) || a.title.localeCompare(b.title) || a.version - b.version);
  return records;
}

function formatInventory(records) {
  const lines = [];
  for (const r of records) {
    lines.push(
      `[${r.storage}] ${r.title.toUpperCase()} v${r.version} ${r.metaType}` +
        (r.owner ? ' owner=' + r.owner.toUpperCase() : ''),
    );
    for (const c of r.contents) lines.push(`    ${c.type.padEnd(14)} ${c.id || '?'} ${c.size} bytes`);
  }
  return lines.join('\n') + '\n';
}

async function dumpInventory({ attachment, outDir, shouldStop, game, includeSystem }) {
  const records = await listInventory({ ...attachment, shouldStop, game, includeSystem });
  const name = game ? 'content-inventory-' + game : 'content-inventory';
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, name + '.json');
  const textPath = path.join(outDir, name + '.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  fs.writeFileSync(textPath, formatInventory(records));
  return { records, jsonPath, textPath };
}

module.exports = { listInventory, formatInventory, dumpInventory };
