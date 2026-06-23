"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Order, Branch } from "@/lib/types"
import { formatPrice } from "@/lib/utils"

const RECEIPT_CONFIG = {
  fallbackBusinessName: "El Club del Repulgue",
  thankYouMessage: "¡Gracias por tu pedido!",
  footer: "Volvé pronto",
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
  const branchAddress = branch?.address || ""

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
      return `
        <div style="margin-bottom:4px;">
          <div style="display:flex;justify-content:space-between;">
            <span style="max-width:55mm;word-break:break-word;">${item.quantity}x ${esc(item.name)}</span>
            <span style="white-space:nowrap;margin-left:4px;">${formatPrice(itemTotal)}</span>
          </div>
          ${modifiersHTML}
        </div>`
    })
    .join("")

  const subtotalRow =
    order.subtotal !== order.total ? row("Subtotal", formatPrice(order.subtotal)) : ""
  const deliveryRow = order.deliveryFee > 0 ? row("Envío", formatPrice(order.deliveryFee)) : ""
  const addressBlock =
    order.deliveryMethod === "delivery" && order.address
      ? `<div style="margin-bottom:2px;"><span style="font-size:11px;color:#444;">Dir: ${esc(order.address)}</span></div>`
      : ""
  const phoneRow = order.customerPhone ? row("Tel", order.customerPhone) : ""

  return `
    <div class="receipt-content" style="font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;width:80mm;padding:4mm 6mm;box-sizing:border-box;line-height:1.4;">
      <div style="text-align:center;margin-bottom:6px;">
        <div style="font-weight:bold;font-size:14px;letter-spacing:1px;text-transform:uppercase;">${esc(businessName)}</div>
        ${branchAddress ? `<div style="font-size:11px;color:#444;">${esc(branchAddress)}</div>` : ""}
      </div>

      ${SOLID_DIVIDER}

      ${row(`Pedido #${orderRef}`, dateStr)}
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

      <div style="text-align:center;margin-top:6px;">
        <div style="font-weight:bold;margin-bottom:2px;">${esc(RECEIPT_CONFIG.thankYouMessage)}</div>
        <div style="font-size:11px;color:#444;">${esc(RECEIPT_CONFIG.footer)}</div>
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
  iframe.style.position = "fixed"
  iframe.style.right = "0"
  iframe.style.bottom = "0"
  iframe.style.width = "0"
  iframe.style.height = "0"
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
          body { background: #fff; }
          @media print {
            @page { margin: 0; size: 80mm auto; }
          }
        </style>
      </head>
      <body>${copies}</body>
    </html>`)
  doc.close()

  const triggerPrint = () => {
    win.focus()
    win.print()
    cleanup()
  }

  win.onafterprint = cleanup
  if (doc.readyState === "complete") {
    triggerPrint()
  } else {
    win.onload = triggerPrint
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
