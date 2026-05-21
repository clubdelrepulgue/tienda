"use client"

import { ShoppingBag, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"

interface HeaderProps {
  onCartOpen: () => void
}

export function Header({ onCartOpen }: HeaderProps) {
  const totalItems = useCartStore((s) => s.totalItems())

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="text-primary">BLZR</span>
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span>Downtown</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-2"
          onClick={onCartOpen}
          aria-label={`Open cart with ${totalItems} items`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
              {totalItems}
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
