#!/usr/bin/env bash
# Abre el panel de mostrador en Chrome con impresión directa: window.print()
# manda el ticket a la impresora predeterminada sin mostrar el diálogo.
#
#   npm run pos:kiosk                                  # http://localhost:3000/admin/pos
#   npm run pos:kiosk -- https://tu-dominio/admin/pos
#
# Notas:
#  - Usa un perfil de Chrome aparte (POS_PROFILE_DIR). Es obligatorio: si se
#    reusa el perfil normal y ya hay un Chrome abierto, el flag --kiosk-printing
#    se ignora porque la ventana nueva la crea el proceso ya corriendo.
#  - Ese perfil recuerda las últimas opciones de impresión (impresora, tamaño de
#    papel, márgenes). La PRIMERA vez imprimí una vez con el diálogo, elegí la
#    térmica + el papel correcto, y de ahí en más sale directo con esa config.
set -euo pipefail

URL="${1:-http://localhost:3000/admin/pos}"
POS_PROFILE_DIR="${POS_PROFILE_DIR:-$HOME/.config/pos-kiosk-chrome}"
LOG="${TMPDIR:-/tmp}/pos-kiosk-chrome.log"

case "$(uname -s)" in
  Darwin) CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}" ;;
  *)      CHROME="${CHROME:-$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)}" ;;
esac

if [ ! -x "$CHROME" ]; then
  echo "✗ No encontré Google Chrome. Instalalo o exportá CHROME=/ruta/al/binario" >&2
  exit 1
fi

# Aviso temprano si el servidor no está levantado: sin esto Chrome abre una
# ventana con "no se puede acceder a este sitio" y parece que falló el kiosk.
if command -v curl >/dev/null 2>&1; then
  if ! curl -sS --max-time 3 -o /dev/null "$URL" 2>/dev/null; then
    echo "⚠  $URL no responde."
    case "$URL" in
      *localhost*|*127.0.0.1*) echo "   Levantá el server primero:  npm run dev" ;;
      *) echo "   Revisá la URL o la conexión." ;;
    esac
    echo "   Abro Chrome igual; recargá la ventana (⌘R) cuando el server esté arriba."
    echo
  fi
fi

mkdir -p "$POS_PROFILE_DIR"

# --disable-background-networking calla el ruido de GCM/component-updater que
# ensucia la consola en un perfil nuevo, y de paso es lo que querés en una caja.
nohup "$CHROME" \
  --kiosk-printing \
  --user-data-dir="$POS_PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --disable-background-networking \
  --app="$URL" \
  >"$LOG" 2>&1 &

echo "✓ Chrome abierto en modo impresión directa (PID $!)"
echo "  URL:     $URL"
echo "  Perfil:  $POS_PROFILE_DIR"
echo "  Log:     $LOG"
