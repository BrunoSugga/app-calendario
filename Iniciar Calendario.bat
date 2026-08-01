@echo off
cd /d "%~dp0"
title App Calendario
echo Iniciando App Calendario...
echo.
call npm run tauri:dev
if errorlevel 1 (
  echo.
  echo Hubo un error al iniciar. Revisa que Node/npm esten instalados.
  pause
)
