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
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-card border-border">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle
            className="text-lg font-bold text-card-foreground flex items-center gap-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            Your Cart ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Your cart is empty</p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Browse Menu
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
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0">
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
                          <h4 className="font-medium text-sm text-card-foreground truncate">
                            {item.name}
                          </h4>
                          <span className="text-sm font-semibold text-primary shrink-0">
                            ${lineTotal.toFixed(2)}
                          </span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.modifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 bg-secondary rounded-lg">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={() =>
                                updateQty(item.id, item.quantity - 1)
                              }
                              aria-label="Decrease quantity"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-medium w-5 text-center text-foreground">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg"
                              onClick={() =>
                                updateQty(item.id, item.quantity + 1)
                              }
                              aria-label="Increase quantity"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Remove ${item.name} from cart`}
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

            <div className="border-t border-border p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="text-lg font-bold text-card-foreground">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
              <Separator />
              <Button
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base"
                asChild
                onClick={onClose}
              >
                <Link href="/checkout">Continue to Checkout</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
