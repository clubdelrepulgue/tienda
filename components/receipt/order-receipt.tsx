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
}

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
    <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:12px;">
      <span style="color:#555;">${esc(label)}:</span>
      <span style="text-align:right;max-width:50mm;word-break:break-word;">${esc(value)}</span>
    </div>`
}

const SOLID_DIVIDER = `<div style="border-top:1px solid #000;margin:5px 0;"></div>`
const DASHED_DIVIDER = `<div style="border-top:1px dashed #888;margin:5px 0;"></div>`

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
          ? `<div style="font-size:10px;color:#555;padding-left:12px;">${esc(
              item.modifiers.map((m) => `+ ${m.optionName} (${formatPrice(m.price)})`).join(", ")
            )}</div>`
          : ""
      const noteHTML = item.note
        ? `<div style="font-size:10px;font-style:italic;color:#333;padding-left:12px;">&#9998; ${esc(item.note)}</div>`
        : ""
      return `
        <div style="margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="max-width:55mm;word-break:break-word;">${item.quantity}x ${esc(item.name)}${item.variantName ? ` (${esc(item.variantName)})` : ""}</span>
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
      ? `<div style="margin-bottom:2px;"><span style="font-size:11px;color:#444;">Dir: ${esc(shortenAddress(order.address))}</span></div>`
      : ""
  const phoneRow = order.customerPhone ? row("Tel", order.customerPhone) : ""

  return `
    <div class="receipt-content" style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;width:80mm;padding:4mm 6mm;box-sizing:border-box;line-height:1.4;">
      <div style="text-align:center;margin-bottom:6px;">
        ${
          logoUrl
            ? `<img src="${esc(logoUrl)}" alt="${esc(businessName)}" style="max-width:38mm;max-height:18mm;object-fit:contain;margin:0 auto 2px;display:block;filter:grayscale(100%) contrast(1.2);" />`
            : `<div style="font-weight:bold;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${esc(businessName)}</div>`
        }
        ${branchAddress ? `<div style="font-size:11px;color:#444;">${esc(branchAddress)}</div>` : ""}
      </div>

      ${SOLID_DIVIDER}

      <div style="text-align:center;margin:2px 0 6px;">
        <div style="font-size:10px;letter-spacing:1px;color:#555;text-transform:uppercase;">Pedido</div>
        <div style="font-weight:bold;font-size:26px;line-height:1;letter-spacing:1px;">#${esc(orderRef)}</div>
        <div style="font-size:11px;color:#444;margin-top:2px;">${esc(dateStr)}</div>
      </div>

      ${SOLID_DIVIDER}

      ${row("Cliente", order.customerName)}
      ${phoneRow}
      ${row("Tipo", deliveryMethodLabel)}
      ${addressBlock}
      ${row("Pago", paymentLabel)}

      ${SOLID_DIVIDER}

      <div style="margin-bottom:4px;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Detalle</div>
      ${itemsHTML}

      ${DASHED_DIVIDER}

      ${subtotalRow}
      ${deliveryRow}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;margin-top:4px;">
        <span>TOTAL</span>
        <span>${formatPrice(order.total)}</span>
      </div>

      ${SOLID_DIVIDER}

      <div style="text-align:center;margin-top:8px;">
        <div style="font-weight:bold;font-size:13px;letter-spacing:1.5px;margin-bottom:4px;">${esc(RECEIPT_CONFIG.thankYouMessage)}</div>
        <div style="font-size:11px;color:#222;margin-bottom:5px;line-height:1.35;">${esc(RECEIPT_CONFIG.tagline)}</div>
        <div style="font-size:10px;color:#666;letter-spacing:0.5px;line-height:1.35;">${esc(RECEIPT_CONFIG.footer)}</div>
      </div>

      <div style="margin-top:8px;text-align:center;font-size:10px;color:#bbb;letter-spacing:4px;">- - - - - - - - - - - -</div>
    </div>`
}

/**
 * Prints `copies` identical receipts in a single job using a hidden iframe.
 * Iframe printing avoids popup blockers and the load race of window.open.
 */
export function printOrderReceipt(order: Order, branch?: Branch | null) {
  if (typeof window === "undefined") return

  const single = renderReceiptHTML(order, branch)
  const copies = Array.from({ length: RECEIPT_CONFIG.copies }, (_, i) => {
    // Page break between copies so each gets its own cut on thermal printers.
    const breakStyle = i < RECEIPT_CONFIG.copies - 1 ? "page-break-after:always;" : ""
    return `<div style="${breakStyle}">${single}</div>`
  }).join("")

  const orderRef = order.orderNumber || order.id.slice(-6)

  const iframe = document.createElement("iframe")
  iframe.setAttribute("aria-hidden", "true")
  // Keep the iframe off-screen but give it a real size. A 0×0 iframe is not
  // laid out by Chrome, so the @page size rule is dropped and printing falls
  // back to A4. An 80mm-wide, positive-height frame forces proper layout.
  iframe.style.position = "fixed"
  iframe.style.left = "-9999px"
  iframe.style.top = "0"
  iframe.style.width = "80mm"
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
          /* Force the printable area to a thermal-roll width (80mm) so the
             browser doesn't fall back to A4. Must live at the top level —
             some engines ignore @page nested inside @media print. */
          @page { size: 80mm auto; margin: 0; }
          html, body { width: 80mm; background: #fff; }
          .receipt-content { width: 80mm !important; }
        </style>
      </head>
      <body>${copies}</body>
    </html>`)
  doc.close()

  // Measures the real rendered height of one receipt and pins the @page size to
  // exactly that, so each copy always lands on a single page instead of being
  // split across two when the browser assumes a fixed (A4/Letter) page height.
  const pinPageHeight = () => {
    const el = doc.querySelector<HTMLElement>(".receipt-content")
    if (!el) return
    const heightPx = el.getBoundingClientRect().height
    if (!heightPx) return
    // px → mm at 96dpi, rounded up with a small buffer so content never spills.
    const heightMm = Math.ceil((heightPx * 25.4) / 96) + 4
    const style = doc.createElement("style")
    // Appended last, so this @page rule overrides the "auto" one above.
    style.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`
    doc.head.appendChild(style)
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
        win.print()
        cleanup()
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
