"use client"

import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/store"

interface CartSheetProps {
  open: boolean
  onClose: () => void
}

export function CartSheet({ open, onClose }: CartSheetProps) {
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const totalPrice = useCartStore((s) => s.totalPrice())

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-white border-border">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle
            className="text-lg font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            Tu Carrito ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm font-medium">Tu carrito está vacío</p>
            <Button
              className="rounded-full bg-primary text-white hover:bg-primary/90 px-5"
              size="sm"
              onClick={onClose}
            >
              Ver menú
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-5 flex flex-col gap-4">
                {items.map((item) => {
                  const modPrice = item.modifiers.reduce(
                    (sum, m) => sum + m.price,
                    0
                  )
                  const lineTotal = (item.price + modPrice) * item.quantity
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-primary/10">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {item.name}
                          </h4>
                          <span className="text-sm font-bold text-primary shrink-0">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.modifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 bg-secondary rounded-lg border border-border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10"
                              onClick={() =>
                                updateQty(item.id, item.quantity - 1)
                              }
                              aria-label="Disminuir cantidad"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-bold w-5 text-center text-foreground">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10"
                              onClick={() =>
                                updateQty(item.id, item.quantity + 1)
                              }
                              aria-label="Aumentar cantidad"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Eliminar ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-5 flex flex-col gap-4 bg-secondary/50">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="text-xl font-extrabold text-foreground">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
              <Separator />
              <Button
                className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold text-base shadow-sm"
                asChild
                onClick={onClose}
              >
                <Link href="/checkout">Ir al checkout</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
