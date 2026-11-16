@echo off
chcp 65001 >nul
set "INICIO=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "CARPETA=%~dp0"
(
  echo @echo off
  echo start "CIPRODEC Radio - Respondedor" /min /d "%CARPETA%" cmd /c "%CARPETA%iniciar.bat"
) > "%INICIO%\CIPRODEC Radio Respondedor.bat"
if exist "%INICIO%\CIPRODEC Radio Respondedor.bat" (
  echo.
  echo  Listo: el respondedor de CIPRODEC Radio va a arrancar solo cada vez que prendas la computadora.
  echo  Para desactivarlo, borra el archivo "CIPRODEC Radio Respondedor.bat" de esta carpeta:
  echo  %INICIO%
) else (
  echo  No se pudo activar el inicio automatico.
)
echo.
pause
