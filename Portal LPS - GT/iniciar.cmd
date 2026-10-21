@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"
if errorlevel 1 (
    echo.
    echo Nao foi possivel iniciar o site. Confira a mensagem acima.
    pause
    exit /b 1
)
