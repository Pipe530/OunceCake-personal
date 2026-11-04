@echo off
rem Double-click launcher for the OunceCake GUI. Needs Node.js 22+.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  choice /m "Install Node.js LTS now with winget"
  if errorlevel 2 (
    start https://nodejs.org/en/download
    pause
    exit /b 1
  )
  winget install -e --id OpenJS.NodeJS.LTS
  echo.
  echo Node.js installed. Close this window and double-click OunceCake.bat again.
  pause
  exit /b 0
)
echo Starting OunceCake... keep this window open; use "Quit OunceCake" in the page to stop.
node gui.cjs
if errorlevel 1 pause
