"use client"

import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"

interface FloatingCartProps {
  onCartOpen: () => void
}

export function FloatingCart({ onCartOpen }: FloatingCartProps) {
  const totalItems = useCartStore((s) => s.totalItems())
  const totalPrice = useCartStore((s) => s.totalPrice())

  if (totalItems === 0) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 md:left-auto md:right-6 md:w-auto">
      <Button
        onClick={onCartOpen}
        className="w-full md:w-auto h-14 rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25 px-6 gap-3 text-base font-semibold"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          <span className="bg-primary-foreground/20 rounded-full px-2 py-0.5 text-sm">
            {totalItems}
          </span>
        </div>
        <span className="flex-1 text-center md:text-left">View Cart</span>
        <span>${totalPrice.toFixed(2)}</span>
      </Button>
    </div>
  )
}
