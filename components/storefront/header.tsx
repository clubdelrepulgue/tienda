"use client"

import Image from "next/image"
import { ShoppingBag, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"
import blzrLogo from "@/img/LOGO BLZR.webp"

interface HeaderProps {
  onCartOpen: () => void
}

export function Header({ onCartOpen }: HeaderProps) {
  const totalItems = useCartStore((s) => s.totalItems())

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <h1
            className="flex items-center"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Image
              src={blzrLogo}
              alt="BLZR"
              priority
              className="h-7 w-auto sm:h-8"
            />
          </h1>
          <div className="hidden sm:flex items-center gap-1.5 text-muted-foreground text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span>Downtown</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="relative h-9 w-9 shrink-0 rounded-xl p-0 sm:w-auto sm:gap-2 sm:px-3"
          onClick={onCartOpen}
          aria-label={`Abrir carrito con ${totalItems} productos`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span className="hidden sm:inline">Carrito</span>
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
