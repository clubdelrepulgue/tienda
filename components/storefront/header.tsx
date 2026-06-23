"use client"

import Image from "next/image"
import Link from "next/link"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"
import type { Branch } from "@/lib/types"

interface HeaderProps {
  branch: Branch
  onCartOpen: () => void
}

export function Header({ branch, onCartOpen }: HeaderProps) {
  const totalItems = useCartStore((s) => s.totalItems())
  const logoUrl = branch.logoUrl || "/assets/brand/logo.jpeg"

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <h1
            className="flex items-center"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white">
                <Image
                  src={logoUrl}
                  alt={branch.name}
                  width={96}
                  height={96}
                  priority
                  className="h-full w-full object-contain"
                />
              </span>
              <span
                className="hidden rounded-full border bg-white px-3 py-1.5 text-sm font-semibold sm:inline"
                style={{
                  borderColor: branch.brandColor || "var(--border)",
                  color: branch.brandColor || "var(--foreground)",
                }}
              >
                {branch.name}
              </span>
            </Link>
          </h1>
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
