#!/usr/bin/env bash
# Abre el panel de mostrador en Chrome con impresión directa: window.print()
# manda el ticket a la impresora predeterminada sin mostrar el diálogo.
#
#   ./scripts/pos-kiosk.sh                       # http://localhost:3000/admin/pos
#   ./scripts/pos-kiosk.sh https://tu-dominio/admin/pos
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

case "$(uname -s)" in
  Darwin) CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ;;
  *)      CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || true)" ;;
esac

if [ ! -x "$CHROME" ]; then
  echo "No encontré Google Chrome. Instalalo o exportá CHROME=/ruta/al/binario" >&2
  exit 1
fi

mkdir -p "$POS_PROFILE_DIR"

exec "$CHROME" \
  --kiosk-printing \
  --user-data-dir="$POS_PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --app="$URL"
