"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Order, Branch } from "@/lib/types"
import { formatPrice } from "@/lib/utils"

const RECEIPT_CONFIG = {
  fallbackBusinessName: "El Club del Repulgue",
  // Footer copy — casual, confident, on-brand. Kept as plain text (no emoji)
  // so it prints cleanly on monochrome thermal printers.
  thankYouMessage: "¡GRACIAS POR TU COMPRA!",
  // Punchy tagline under the thank-you line.
  tagline: "Hecho al momento, con la mejor onda.",
  // Small call-to-action / social prompt at the very bottom.
  footer: "Seguinos en redes y volvé cuando quieras.",
  // Number of identical copies to print per job.
  copies: 2,
  // Apila las copias en una sola página en vez de una página por copia.
  // Sirve cuando el driver impone una página larga y fija (p. ej. 80x420mm) y no
  // se puede cambiar: el papel en blanco de relleno se paga una vez y no `copies`
  // veces. Ponelo en false si el driver tiene largo variable o un tamaño a medida
  // ajustado al ticket — ahí una página por copia es lo correcto.
  stackCopies: true,
  // Ancho del rollo, en mm. 80 para las térmicas estándar, 58 para las angostas.
  paperWidthMm: 80,
  // Alto de página, en mm. "auto" mide el ticket ya renderizado y fija el
  // @page a esa altura exacta (lo correcto para PDF y para drivers con rollo de
  // largo variable). Si tu driver sólo ofrece un tamaño de papel fijo, poné acá
  // ese mismo número para que Chrome no reescale ni agregue papel de más.
  // Tiene que coincidir con el tamaño de papel del driver, si no Chrome reescala
  // el ticket para encajarlo. Hoy el driver de la V320N está en 80x420mm.
  paperHeightMm: 420 as "auto" | number,
  // Papel extra al final de cada copia, en mm: espacio para el corte.
  feedAfterMm: 2,
}

const PAPER_W = RECEIPT_CONFIG.paperWidthMm
// Padding lateral del ticket (mm por lado) y ancho útil resultante.
const SIDE_PADDING_MM = 6
const CONTENT_W = PAPER_W - SIDE_PADDING_MM * 2
// Ancho máximo de las columnas que pueden desbordar (valores de fila y nombres
// de ítem), como fracción del ancho útil.
const VALUE_MAX_MM = Math.round(CONTENT_W * 0.73)
const ITEM_MAX_MM = Math.round(CONTENT_W * 0.81)

// ── HTML escaping (order data is user-entered) ──────────────────
function esc(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ""
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

const DELIVERY_METHOD_LABELS: Record<string, string> = {
  delivery: "Delivery",
  pickup: "Retiro en local",
  dine_in: "En el local",
}

const PAYMENT_LABELS: Record<string, string> = {
  mercadopago: "Mercado Pago",
  cash: "Efectivo",
}

/**
 * Trims noise from a formatted address for the compact receipt: drops the
 * "Departamento de …" and country segments, strips leading postal codes, and
 * keeps street + city.
 * "Zorrilla de San Martín 965, 60000 Paysandú, Departamento de Paysandú, Uruguay"
 *   → "Zorrilla de San Martín 965, Paysandú"
 */
function shortenAddress(address: string): string {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/departamento|uruguay/i.test(part))
    // Remove a leading postal code (4+ digits) while keeping street numbers.
    .map((part) => part.replace(/^\d{4,}\s+/, "").trim())
    .join(", ")
}

function row(label: string, value: string): string {
  return `
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-size:13px;font-weight:600;">
      <span style="color:#000;">${esc(label)}:</span>
      <span style="text-align:right;max-width:${VALUE_MAX_MM}mm;word-break:break-word;font-weight:700;">${esc(value)}</span>
    </div>`
}

const SOLID_DIVIDER = `<div style="border-top:2px solid #000;margin:6px 0;"></div>`
const DASHED_DIVIDER = `<div style="border-top:2px dashed #000;margin:6px 0;"></div>`

/**
 * Builds the inner HTML of a single receipt for the given order + branch.
 * Single source of truth shared by the on-screen preview and the printer.
 */
export function renderReceiptHTML(order: Order, branch?: Branch | null): string {
  const businessName = branch?.name || RECEIPT_CONFIG.fallbackBusinessName
  const branchAddress = shortenAddress(branch?.address || "")
  const logoUrl = branch?.logoUrl || ""

  const deliveryMethodLabel = DELIVERY_METHOD_LABELS[order.deliveryMethod] || order.deliveryMethod
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod
  const orderRef = order.orderNumber || order.id.slice(-6).toUpperCase()

  const dateStr = new Date(order.createdAt).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const itemsHTML = order.items
    .map((item) => {
      const itemTotal =
        (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity
      const modifiersHTML =
        item.modifiers.length > 0
          ? `<div style="font-size:11px;color:#000;padding-left:12px;font-weight:600;margin-top:1px;">${esc(
              item.modifiers.map((m) => `+ ${m.optionName} (${formatPrice(m.price)})`).join(", ")
            )}</div>`
          : ""
      const noteHTML = item.note
        ? `<div style="font-size:11px;font-style:italic;color:#000;padding-left:12px;font-weight:700;margin-top:1px;">✎ ${esc(item.note)}</div>`
        : ""
      return `
        <div style="margin-bottom:5px;">
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;">
            <span style="max-width:${ITEM_MAX_MM}mm;word-break:break-word;">${item.quantity}x ${esc(item.name)}${item.variantName ? ` (${esc(item.variantName)})` : ""}</span>
            <span style="white-space:nowrap;margin-left:4px;">${formatPrice(itemTotal)}</span>
          </div>
          ${modifiersHTML}
          ${noteHTML}
        </div>`
    })
    .join("")

  const subtotalRow =
    order.subtotal !== order.total ? row("Subtotal", formatPrice(order.subtotal)) : ""
  const deliveryRow = order.deliveryFee > 0 ? row("Envío", formatPrice(order.deliveryFee)) : ""
  const addressBlock =
    order.deliveryMethod === "delivery" && order.address
      ? `<div style="margin-bottom:3px;"><span style="font-size:12px;color:#000;font-weight:600;">Dir: ${esc(shortenAddress(order.address))}</span></div>`
      : ""
  const phoneRow = order.customerPhone ? row("Tel", order.customerPhone) : ""

  return `
    <div class="receipt-content" style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#000;background:#fff;width:${PAPER_W}mm;padding:4mm ${SIDE_PADDING_MM}mm;box-sizing:border-box;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
      <div style="text-align:center;margin-bottom:8px;">
        ${
          logoUrl
            ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}" style="max-width:38mm;max-height:18mm;object-fit:contain;margin:0 auto 3px;display:block;filter:grayscale(100%) contrast(1.5) brightness(0.9);" />`
            : `<div style="font-weight:900;font-size:16px;letter-spacing:1px;text-transform:uppercase;color:#000;">${esc(businessName)}</div>`
        }
        ${branchAddress ? `<div style="font-size:12px;color:#000;font-weight:600;">${esc(branchAddress)}</div>` : ""}
      </div>

      ${SOLID_DIVIDER}

      <div style="text-align:center;margin:4px 0 8px;">
        <div style="font-size:11px;letter-spacing:1px;color:#000;text-transform:uppercase;font-weight:700;">Pedido</div>
        <div style="font-weight:900;font-size:32px;line-height:1;letter-spacing:2px;color:#000;">#${esc(orderRef)}</div>
        <div style="font-size:12px;color:#000;margin-top:3px;font-weight:600;">${esc(dateStr)}</div>
      </div>

      ${SOLID_DIVIDER}

      ${row("Cliente", order.customerName)}
      ${phoneRow}
      ${row("Tipo", deliveryMethodLabel)}
      ${addressBlock}
      ${row("Pago", paymentLabel)}

      ${SOLID_DIVIDER}

      <div style="margin-bottom:5px;font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#000;">Detalle</div>
      ${itemsHTML}

      ${DASHED_DIVIDER}

      ${subtotalRow}
      ${deliveryRow}
      <div style="display:flex;justify-content:space-between;font-weight:900;font-size:16px;margin-top:5px;color:#000;">
        <span>TOTAL</span>
        <span>${formatPrice(order.total)}</span>
      </div>

      ${SOLID_DIVIDER}

      <div style="text-align:center;margin-top:10px;">
        <div style="font-weight:900;font-size:14px;letter-spacing:1.5px;margin-bottom:4px;color:#000;">${esc(RECEIPT_CONFIG.thankYouMessage)}</div>
        <div style="font-size:12px;color:#000;margin-bottom:5px;line-height:1.4;font-weight:600;">${esc(RECEIPT_CONFIG.tagline)}</div>
        <div style="font-size:11px;color:#000;letter-spacing:0.5px;line-height:1.4;font-weight:500;">${esc(RECEIPT_CONFIG.footer)}</div>
      </div>

      <div style="margin-top:10px;text-align:center;font-size:11px;color:#000;letter-spacing:4px;font-weight:700;">- - - - - - - - - - - -</div>
    </div>`
}

/**
 * Prints `copies` identical receipts in a single job using a hidden iframe.
 * Iframe printing avoids popup blockers and the load race of window.open.
 */
export function printOrderReceipt(order: Order, branch?: Branch | null) {
  if (typeof window === "undefined") return

  const single = renderReceiptHTML(order, branch)
  // Cada copia es su propia página. El salto va como `break-before` en las
  // copias 2..n en vez de `break-after` en las 1..n-1: así nunca queda una
  // página vacía al final, que en un rollo térmico son varios cm de papel.
  const copies = Array.from(
    { length: RECEIPT_CONFIG.copies },
    () => `<div class="receipt-page">${single}</div>`
  ).join("")

  const orderRef = order.orderNumber || order.id.slice(-6)

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  // Keep the iframe off-screen but give it a real size. A 0×0 iframe is not
  // laid out by Chrome, so the @page size rule is dropped and printing falls
  // back to A4. Un frame del ancho del rollo y con alto real fuerza el layout.
  iframe.style.position = "fixed"
  iframe.style.left = "-9999px"
  iframe.style.top = "0"
  iframe.style.width = `${PAPER_W}mm`
  iframe.style.height = "100vh"
  iframe.style.border = "0"
  document.body.appendChild(iframe)

  const cleanup = () => {
    setTimeout(() => {
      try {
        document.body.removeChild(iframe)
      } catch {
        /* already removed */
      }
    }, 1000)
  }

  const doc = iframe.contentWindow?.document
  const win = iframe.contentWindow
  if (!doc || !win) {
    cleanup()
    return
  }

  doc.open()
  doc.write(`<!DOCTYPE html>
    <html>
      <head>
        <title>Recibo #${esc(orderRef)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: ${PAPER_W}mm; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Sin esto, 1px de desborde genera una página extra que en un rollo
             continuo se traduce en un montón de papel en blanco. */
          body { overflow: hidden; }
          .receipt-page { width: ${PAPER_W}mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
          .receipt-page + .receipt-page { ${
            RECEIPT_CONFIG.stackCopies
              ? `margin-top: ${RECEIPT_CONFIG.feedAfterMm}mm;`
              : "break-before: page; page-break-before: always;"
          } }
          .receipt-content { width: ${PAPER_W}mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { margin: 0; padding: 0; }
          }
        </style>
        <!-- El alto real se calcula tras renderizar y se escribe acá.
             Ojo: \`size: 80mm auto\` NO es válido en CSS (la forma con dos
             valores exige dos longitudes), así que el navegador descartaba la
             regla entera y caía al tamaño de papel del driver — de ahí el
             ticket kilométrico. Este placeholder ya es válido. -->
        <style id="receipt-page-size">@page { size: ${PAPER_W}mm ${
          RECEIPT_CONFIG.paperHeightMm === "auto" ? 200 : RECEIPT_CONFIG.paperHeightMm
        }mm; margin: 0; }</style>
      </head>
      <body>${copies}</body>
    </html>`)
  doc.close()

  // Mide el alto real de una copia y fija el @page exactamente a esa medida,
  // para que cada ticket ocupe una página justa en vez de una hoja A4/rollo
  // completo. Además clava el alto de cada copia: con `overflow: hidden` eso
  // garantiza que nada se derrame a una segunda página.
  const pinPageHeight = () => {
    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".receipt-page"))
    if (pages.length === 0) return

    const tallestPx = Math.max(...pages.map((page) => page.getBoundingClientRect().height))
    const measuredMm = tallestPx
      ? Math.ceil((tallestPx * 25.4) / 96) + RECEIPT_CONFIG.feedAfterMm
      : 0
    if (measuredMm) {
      // Útil para elegir el tamaño de papel personalizado en el driver.
      console.debug(`[recibo] alto medido: ${PAPER_W}mm x ${measuredMm}mm`)
    }

    if (typeof RECEIPT_CONFIG.paperHeightMm === "number") {
      // Alto fijo: el @page estático ya trae la medida. No clavamos el alto de
      // cada copia y soltamos el recorte, así un pedido largo se derrama a una
      // segunda página en vez de salir cortado.
      doc.body.style.overflow = "visible"
      pages.forEach((page) => {
        page.style.overflow = "visible"
      })
      return
    }

    if (!measuredMm) return
    pages.forEach((page) => {
      page.style.height = `${measuredMm}mm`
    })
    const pageStyle = doc.getElementById("receipt-page-size")
    if (pageStyle) {
      pageStyle.textContent = `@page { size: ${PAPER_W}mm ${measuredMm}mm; margin: 0; }`
    }
  }

  let printed = false
  const triggerPrint = () => {
    if (printed) return
    printed = true
    // Wait for a paint frame so Chrome has laid the receipt out; printing too
    // early makes it ignore @page and fall back to A4.
    win.requestAnimationFrame(() => {
      setTimeout(() => {
        pinPageHeight()
        win.focus()
        try {
          // Bloquea hasta que se cierra el diálogo de impresión, así que
          // recién después es seguro desmontar el iframe.
          win.print()
        } finally {
          cleanup()
        }
      }, 50)
    })
  }

  // Wait for the branch logo (remote image) to finish loading, otherwise it
  // prints blank. Fall back to a timeout so a broken/slow image never blocks.
  const waitForImagesThenPrint = () => {
    const images = Array.from(doc.images || [])
    const pending = images.filter((img) => !img.complete)
    if (pending.length === 0) {
      triggerPrint()
      return
    }
    let remaining = pending.length
    const done = () => {
      remaining -= 1
      if (remaining <= 0) triggerPrint()
    }
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true })
      img.addEventListener("error", done, { once: true })
    })
    // Safety net: never wait more than 2s for images.
    setTimeout(triggerPrint, 2000)
  }

  win.onafterprint = cleanup
  if (doc.readyState === "complete") {
    waitForImagesThenPrint()
  } else {
    win.onload = waitForImagesThenPrint
  }
}

export function PrintReceiptButton({
  order,
  branch,
  variant = "outline",
  label = "Recibo",
}: {
  order: Order
  branch?: Branch | null
  variant?: "outline" | "ghost" | "default"
  label?: string
}) {
  return (
    <Button
      data-print-button
      size="sm"
      variant={variant}
      className="h-8 rounded-lg gap-1.5"
      onClick={() => printOrderReceipt(order, branch)}
      title="Imprimir recibo (2 copias)"
    >
      <Printer className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  )
}

export function ReceiptPreview({ order, branch }: { order: Order; branch?: Branch | null }) {
  return (
    <div
      style={{
        background: "#f5f5f5",
        display: "flex",
        justifyContent: "center",
        padding: "16px",
        borderRadius: "8px",
      }}
    >
      <div
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)", background: "#fff" }}
        dangerouslySetInnerHTML={{ __html: renderReceiptHTML(order, branch) }}
      />
    </div>
  )
}
