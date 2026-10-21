@echo off
setlocal
cd /d "%~dp0"
echo Starting Local FaceIQ at http://127.0.0.1:3000
echo Keep this window open while using the app. Press Ctrl+C to stop.
node scripts\run-local.mjs start
if errorlevel 1 pause
