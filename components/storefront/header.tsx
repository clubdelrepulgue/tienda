"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore } from "@/lib/store"
import { LoginButton } from "@/components/account/login-button"
import type { Branch } from "@/lib/types"

interface HeaderProps {
  branch: Branch
  onCartOpen: () => void
}

export function Header({ branch, onCartOpen }: HeaderProps) {
  const totalItems = useCartStore((s) => s.totalItems())
  const logoUrl = branch.logoUrl || "/assets/brand/logo.jpeg"

  return (
    <header className="sticky top-0 z-50 min-h-[var(--storefront-header-height)] bg-background/80 backdrop-blur-xl">
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center">
          <Link
            href="/"
            aria-label="Volver a elegir restaurante"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground shadow-[0_8px_22px_rgba(20,20,20,0.08)] transition duration-200 hover:-translate-x-0.5 hover:bg-[#F3F3F3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
        <h1
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          <Link href="/" className="flex items-center">
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
          </Link>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <LoginButton />
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
      </div>
    </header>
  )
}
