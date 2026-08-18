@echo off
REM Abre el panel de mostrador en Chrome con impresion directa: window.print()
REM manda el ticket a la impresora predeterminada sin mostrar el dialogo.
REM
REM   pos-kiosk.cmd
REM   pos-kiosk.cmd https://www.clubdelrepulgue.uy/admin/pos
REM
REM Usa un perfil de Chrome aparte. Es obligatorio: si se reusa el perfil normal
REM y ya hay un Chrome abierto, el flag --kiosk-printing se ignora porque la
REM ventana nueva la crea el proceso que ya esta corriendo.
REM
REM La PRIMERA vez hay que imprimir una vez CON el dialogo desde esta ventana y
REM dejar elegido: la impresora termica, "Margenes: Ninguno", "Escala: 100" y
REM los encabezados/pies DESMARCADOS. Chrome guarda eso en el perfil y de ahi en
REM mas imprime solo con esa config.
setlocal

set "URL=%~1"
if "%URL%"=="" set "URL=https://www.clubdelrepulgue.uy/admin/pos"
set "PROFILE=%LOCALAPPDATA%\pos-kiosk-chrome"

set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
) do if not defined CHROME if exist %%P set "CHROME=%%~P"

if not defined CHROME (
  echo [X] No encontre Google Chrome en las rutas habituales.
  echo     Edita la variable CHROME en este archivo con la ruta real.
  pause
  exit /b 1
)

start "" "%CHROME%" ^
  --kiosk-printing ^
  --user-data-dir="%PROFILE%" ^
  --no-first-run ^
  --no-default-browser-check ^
  --disable-background-networking ^
  --app="%URL%"

echo [OK] Chrome abierto en modo impresion directa
echo      URL:    %URL%
echo      Perfil: %PROFILE%
