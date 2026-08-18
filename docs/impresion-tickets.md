# Impresión de tickets

El ticket se arma en `components/receipt/order-receipt.tsx` y se imprime desde un
iframe oculto con `window.print()`. Todo lo configurable está en `RECEIPT_CONFIG`,
arriba del archivo:

| Opción | Qué hace |
|---|---|
| `copies` | Copias por impresión (hoy 2). |
| `paperWidthMm` | Ancho del rollo: `80` (estándar) o `58` (angosto). Ajusta el ticket entero. |
| `paperHeightMm` | `"auto"` mide el ticket y fija el `@page` a esa altura exacta. Un número fija el alto (usalo si tu driver sólo tiene un tamaño de papel fijo). |
| `feedAfterMm` | Papel extra al final de cada copia, para el corte. |

## La impresora

**V320N** — térmica de tickets, rollo de **80mm**, 230mm/s, ESC/POS, USB + LAN.
Hoy está conectada por **USB**. (Si algún día se pasa a red, el camino bueno es
mandarle ESC/POS directo al puerto 9100 y olvidarse del driver y del diálogo.)

## "Sale con largo de hoja A4"

`@page { size: 80mm <alto> }` sólo manda cuando el destino es **Guardar como PDF**.
Al imprimir a una impresora real, Chrome usa el **tamaño de papel del driver** y,
si no coincide con el `@page`, reescala y/o alarga la página. O sea: el largo de
más se arregla en el driver, no en el código.

Los drivers de estas 80mm traen como predeterminado un papel de `80 x 297mm`
(el alto de un A4). Ese es exactamente el síntoma: el driver rellena con líneas
en blanco hasta completar los 297mm. Se arregla creando un tamaño a medida.

En macOS:

1. **Ajustes del sistema → Impresoras y escáneres** → seleccionar la V320N.
2. Desde Chrome, abrir el diálogo del sistema con `⌥⌘P` → menú
   **Tamaño del papel → Gestionar tamaños personalizados…** → `+`.
3. Crear uno: ancho `80 mm`, alto `150 mm`, y **los cuatro márgenes en 0**.
   Nombralo `Ticket 80x150`.
4. Elegirlo en el diálogo y dejarlo pegado (ver la sección de kiosk).
5. Si el driver de la V320N ofrece un modo de rollo con largo variable
   ("Roll Paper", "Receipt", "Document length: variable"), preferilo: la
   impresora avanza sólo lo impreso y no hay papel de sobra.

Después poné ese mismo alto en `RECEIPT_CONFIG.paperHeightMm` (`150`) para que
Chrome no reescale el contenido:

```ts
paperHeightMm: 150,
```

**Cómo saber qué alto usar:** imprimí un ticket con la consola del navegador
abierta. El código loguea `[recibo] alto medido: 80mm x NNmm` con la medida real
del ticket. Elegí un alto cómodo para un pedido normal — si un pedido sale más
largo, se derrama a una segunda página (más papel, pero nunca cortado).

## La caja del local corre Windows

El mostrador imprime desde una notebook con **Windows**, no desde la Mac de
desarrollo. Para esa máquina va `scripts/pos-kiosk.cmd` (doble click, o
`pos-kiosk.cmd https://otra-url/admin/pos`). `scripts/pos-kiosk.sh` es el
equivalente para macOS/Linux.

### Ajustes del diálogo de Chrome (una sola vez, en el perfil del kiosk)

Estos tres son los que arruinan el ticket y **no se pueden forzar desde el
código** — son del navegador, los tiene que dejar puestos la persona:

| Ajuste | Valor | Por qué |
|---|---|---|
| **Encabezados y pies de página** | **desmarcado** | Si está marcado, Chrome imprime la fecha y `Recibo #NN` arriba y la URL abajo, y **fuerza márgenes** que descuadran todo el ticket. |
| **Márgenes** | **Ninguno** | "Predeterminado" mete márgenes propios e ignora el `margin: 0` del `@page`. |
| **Escala** | **Predeterminada / 100** | "Ajustar al ancho de página" achica o agranda el ticket contra el papel del driver. |

Están todos bajo **Más opciones** (o **Configuración adicional**) en el diálogo.
Chrome los recuerda por perfil, por eso el kiosk usa uno propio: se configuran
una vez y quedan.

### Tamaño de papel en Windows

**Panel de control → Dispositivos e impresoras** → click derecho en la V320N →
**Preferencias de impresión** → **Tamaño del papel**. Si no hay uno a medida,
casi todos estos drivers traen un botón para crear uno: ancho `80mm`, alto el
que mida el ticket, márgenes 0.

## Imprimir sin el diálogo

Los navegadores no permiten imprimir en silencio desde la página; la única vía
soportada es arrancar Chrome con `--kiosk-printing`, que hace que `window.print()`
mande el trabajo directo a la impresora predeterminada.

```bash
npm run pos:kiosk                          # macOS/Linux, http://localhost:3000/admin/pos
npm run pos:kiosk -- https://tu-dominio/admin/pos
```

En Windows: doble click en `scripts/pos-kiosk.cmd`.

Si no querés copiar el `.cmd` a la máquina del local (algunos antivirus los
bloquean), sale igual con un acceso directo hecho a mano: click derecho en el
escritorio → **Nuevo → Acceso directo**, y pegar esto como destino, en una sola
línea:

```
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --user-data-dir="%LOCALAPPDATA%\pos-kiosk-chrome" --no-first-run --disable-background-networking --app="https://www.clubdelrepulgue.uy/admin/pos"
```

El script usa un perfil de Chrome aparte (`~/.config/pos-kiosk-chrome`). Es
necesario: con el perfil normal y un Chrome ya abierto, el flag se ignora.

**La primera vez** imprimí un ticket con el diálogo desde ese perfil y dejá
elegida la impresora térmica, el tamaño de papel personalizado y márgenes
"Ninguno". Chrome guarda esas opciones en el perfil y el modo kiosk las reusa en
todas las impresiones siguientes.

Para dejarlo fijo en la caja, agregá `scripts/pos-kiosk.sh` a los ítems de inicio
de sesión de la Mac.

## Si aún así no alcanza

El camino a prueba de balas para una térmica es hablarle en **ESC/POS** en vez de
imprimir HTML: un agente local (o WebUSB) que reciba el pedido y mande los bytes
al puerto. Ahí el corte, el largo y la fuente los controlás vos, no el driver.
Es bastante más trabajo que lo de arriba.
