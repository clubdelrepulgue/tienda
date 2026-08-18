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

## Imprimir sin el diálogo

Los navegadores no permiten imprimir en silencio desde la página; la única vía
soportada es arrancar Chrome con `--kiosk-printing`, que hace que `window.print()`
mande el trabajo directo a la impresora predeterminada.

```bash
npm run pos:kiosk                          # http://localhost:3000/admin/pos
npm run pos:kiosk -- https://tu-dominio/admin/pos
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
