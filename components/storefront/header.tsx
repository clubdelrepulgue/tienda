"use client"

import Image from "next/image"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"

interface HeaderProps {
  onCartOpen: () => void
}

export function Header({ onCartOpen }: HeaderProps) {
  const totalItems = useCartStore((s) => s.totalItems())
  const totalPrice = useCartStore((s) => s.totalPrice())

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="mx-auto max-w-5xl flex items-center justify-between px-4 py-2 gap-4">
        {/* Logo */}
        <div className="flex items-center">
          <Image
            src="/assets/brand/logo.jpeg"
            alt="El Club del Repulgue — Empanadas"
            width={68}
            height={68}
            className="rounded-2xl shadow-md"
            priority
          />
        </div>

        {/* Cart button — right */}
        <div className="flex justify-end ml-auto">
          <Button
            className="relative gap-2 rounded-full bg-primary text-white hover:bg-primary/90 shadow-sm px-4 h-10"
            onClick={onCartOpen}
            aria-label={`Abrir carrito con ${totalItems} productos`}
          >
            <div className="relative">
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-white text-primary text-[10px] flex items-center justify-center font-bold">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="hidden sm:inline font-semibold text-sm">
              Mi pedido
            </span>
            {totalItems > 0 && (
              <>
                <span className="hidden sm:inline text-white/60">|</span>
                <span className="hidden sm:inline font-bold text-sm">
                  ${totalPrice.toFixed(0)}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
