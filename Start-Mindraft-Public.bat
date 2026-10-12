@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Mindraft.ps1"
if errorlevel 1 (
    echo.
    echo Mindraft could not be started. Check the message above and .runtime logs.
    pause
    exit /b 1
)
echo.
echo Mindraft is running. Close this window when ready.
pause
