# OunceCake - Cellenseres

 variant of [ariankordi/OunceCake](https://github.com/ariankordi/OunceCake), based on [misshexa66/OunceCake](https://github.com/misshexa66/OunceCake). Upstream history, attribution and the GPL-2.0 license are retained.

The upstream HTTP/WebDAV server exposes game ExeFS and RomFS and supports firmware/system-data exports. This variant adds installed native-title ELicense preparation, base-only views and raw NCA export.

## Requirements

Use Node.js 22 or newer and an already held run from [our ns2jb variant](https://github.com/Cellenseres/ns2jb). No npm dependencies are needed. Keep SmileBASIC and the runner open while OunceCake is attached. OunceCake does not start a bootstrap; the upstream ns2jb acquisition uses temporary save files. Review the [console storage policy](docs/CONSOLE-ACCESS.md).

## Browse a title

### GUI

Double-click `OunceCake.bat`. If Node.js isn't found, it offers to install Node.js LTS with `winget`; otherwise it opens the GUI in your browser automatically.

The page lets you:
- **Browse...** to pick the held run directory and the NCA export output folder with a Windows folder dialog, instead of typing a path.
- Connect and pick a game from a filterable list.
- Either serve it (port, base-only) or export raw NCAs (output folder, skip Program).
- Watch logs and the server address on the page.
- Click **Quit OunceCake** to stop the server and close the attachment,.

A small console window stays open behind the browser tab while the GUI runs; closing it also stops OunceCake.

### Serving

Open the server address shown on the page. `/base/exefs/` contains CodeFS files; `/base/romfs/` contains the RomFS tree. `/base/control/` (and `/updates/<version>/control/` for updates) contains the decrypted Control NCA files (`control.nacp` and the `icon_*.dat` JPEG icons). `logo/`, `manual/`, `legal/` and `meta/` are served the same way for base and updates. Each is skipped with a log line when the title doesn't have it. The same paths support read-only WebDAV. The base-only option omits update and DLC discovery.

ELicense preparation uses the content's FS606 RightsId and installed owner accounts. The rights context stays open throughout serving. No separate registration script or plaintext titlekey is needed. A prior FS206 RomFS read succeeded; complete native-title ExeFS and HTTP serving still require the [manual checks](docs/VALIDATION.md).

## List all installed content

After connecting, use **List content for selected game** (that game's base, updates, DLC and Switch 2 variants) or **List all installed content** (everything; system storage only if ticked) in the GUI. It reads the console's content database and writes a `.txt` and `.json` file to the chosen folder. Each record shows the title ID, version, meta type, owner application (for updates and DLC) and every NCA it contains (type, ID, size), including content types the file browser doesn't mount.

## Export raw NCAs

Choose **Export raw NCAs** in the GUI and set the output folder. Tick **Skip Program NCA** to omit the Program NCA. These files remain encrypted. Existing output files are preserved; incomplete captures have a `.partial` suffix. Quitting stops before the next read and releases owned handles.

## Native server build

The native server is built with clang and lld. The upstream macOS harness remains under `engine/oz-code/test/`. Local checks stay untracked.

See [provenance](docs/PROVENANCE.md) for source revisions and validation limits.
