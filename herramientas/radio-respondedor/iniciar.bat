@echo off
chcp 65001 >nul
title CIPRODEC Radio - Respondedor de saludos
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js. Se abre la pagina de descarga:
  echo  bajar la version LTS, instalar con Siguiente-Siguiente y volver a abrir este archivo.
  echo.
  start https://nodejs.org/es/download
  pause
  exit /b
)
:inicio
node respondedor.js
echo.
echo  El respondedor se detuvo. Se reinicia en 30 segundos (cerrar la ventana para cortarlo)...
timeout /t 30 >nul
goto inicio
