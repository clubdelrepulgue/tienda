"use client"

import { useRef } from "react"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Order } from "@/lib/types"

const RECEIPT_CONFIG = {
  businessName: "BLAZR",
  instagram: "",
  phone: "",
  thankYouMessage: "¡Gracias por tu pedido!",
  footer: "Volvé pronto",
}

function ReceiptContent({ order }: { order: Order }) {
  const deliveryMethodLabel = {
    delivery: "Delivery",
    pickup: "Retiro en local",
    dine_in: "En el local",
  }[order.deliveryMethod]

  const paymentLabel = {
    mercadopago: "Mercado Pago",
    cash: "Efectivo",
  }[order.paymentMethod]

  const dateStr = new Date(order.createdAt).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div
      className="receipt-content"
      style={{
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: "12px",
        color: "#000",
        background: "#fff",
        width: "80mm",
        padding: "4mm 6mm",
        boxSizing: "border-box",
        lineHeight: "1.4",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "6px" }}>
        <div style={{ fontWeight: "bold", fontSize: "14px", letterSpacing: "1px", textTransform: "uppercase" }}>
          {RECEIPT_CONFIG.businessName}
        </div>
        {RECEIPT_CONFIG.instagram && (
          <div style={{ fontSize: "11px" }}>{RECEIPT_CONFIG.instagram}</div>
        )}
        {RECEIPT_CONFIG.phone && (
          <div style={{ fontSize: "11px" }}>{RECEIPT_CONFIG.phone}</div>
        )}
      </div>

      <Divider />

      {/* Order info */}
      <Row label={`Pedido #${order.orderNumber || order.id.slice(-6).toUpperCase()}`} value={dateStr} />
      <Row label="Cliente" value={order.customerName} />
      {order.customerPhone && <Row label="Tel" value={order.customerPhone} />}
      <Row label="Tipo" value={deliveryMethodLabel} />
      {order.deliveryMethod === "delivery" && order.address && (
        <div style={{ marginBottom: "2px" }}>
          <span style={{ fontSize: "11px", color: "#444" }}>Dir: {order.address}</span>
        </div>
      )}
      <Row label="Pago" value={paymentLabel} />

      <Divider />

      {/* Items */}
      <div style={{ marginBottom: "4px", fontWeight: "bold", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Detalle
      </div>
      {order.items.map((item) => {
        const itemTotal = (item.price + item.modifiers.reduce((s, m) => s + m.price, 0)) * item.quantity
        return (
          <div key={item.id} style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ maxWidth: "55mm", wordBreak: "break-word" }}>
                {item.quantity}x {item.name}
              </span>
              <span style={{ whiteSpace: "nowrap", marginLeft: "4px" }}>
                ${itemTotal.toFixed(2)}
              </span>
            </div>
            {item.modifiers.length > 0 && (
              <div style={{ fontSize: "10px", color: "#555", paddingLeft: "12px" }}>
                {item.modifiers.map((m) => `+ ${m.optionName} ($${m.price.toFixed(2)})`).join(", ")}
              </div>
            )}
          </div>
        )
      })}

      <Divider dashed />

      {/* Totals */}
      {order.subtotal !== order.total && (
        <Row label="Subtotal" value={`$${order.subtotal.toFixed(2)}`} />
      )}
      {order.deliveryFee > 0 && (
        <Row label="Envío" value={`$${order.deliveryFee.toFixed(2)}`} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>
        <span>TOTAL</span>
        <span>${order.total.toFixed(2)}</span>
      </div>

      <Divider />

      {/* Footer */}
      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <div style={{ fontWeight: "bold", marginBottom: "2px" }}>{RECEIPT_CONFIG.thankYouMessage}</div>
        <div style={{ fontSize: "11px", color: "#444" }}>{RECEIPT_CONFIG.footer}</div>
        {RECEIPT_CONFIG.instagram && (
          <div style={{ fontSize: "11px", marginTop: "4px" }}>{RECEIPT_CONFIG.instagram}</div>
        )}
      </div>

      {/* Cut line */}
      <div style={{ marginTop: "8px", textAlign: "center", fontSize: "10px", color: "#bbb", letterSpacing: "4px" }}>
        - - - - - - - - - - - -
      </div>
    </div>
  )
}

function Divider({ dashed }: { dashed?: boolean }) {
  return (
    <div
      style={{
        borderTop: dashed ? "1px dashed #888" : "1px solid #000",
        margin: "5px 0",
      }}
    />
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px", fontSize: "12px" }}>
      <span style={{ color: "#555" }}>{label}:</span>
      <span style={{ textAlign: "right", maxWidth: "50mm", wordBreak: "break-word" }}>{value}</span>
    </div>
  )
}

export function PrintReceiptButton({ order, variant = "outline" }: { order: Order; variant?: "outline" | "ghost" | "default" }) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return

    const printWindow = window.open("", "_blank", "width=400,height=600")
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recibo #${order.orderNumber || order.id.slice(-6)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; display: flex; justify-content: center; }
            @media print {
              body { width: 80mm; }
              @page { margin: 0; size: 80mm auto; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  return (
    <>
      {/* Hidden receipt node used for printing */}
      <div ref={receiptRef} style={{ display: "none" }}>
        <ReceiptContent order={order} />
      </div>

      <Button
        size="sm"
        variant={variant}
        className="h-8 rounded-lg gap-1.5"
        onClick={handlePrint}
        title="Imprimir recibo"
      >
        <Printer className="h-3.5 w-3.5" />
        <span>Recibo</span>
      </Button>
    </>
  )
}

export function ReceiptPreview({ order }: { order: Order }) {
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
      <div style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.15)", background: "#fff" }}>
        <ReceiptContent order={order} />
      </div>
    </div>
  )
}
