@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Tallo.ps1"
if errorlevel 1 (
    echo.
    echo Tallo could not be started. Check the message above and .runtime logs.
    pause
    exit /b 1
)
echo.
echo Tallo is running. Close this window when ready.
pause
