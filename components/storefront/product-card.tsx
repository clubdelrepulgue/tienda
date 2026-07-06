"use client"

import Image from "next/image"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Product } from "@/lib/types"
import { formatPrice } from "@/lib/utils"

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
  onQuickAdd: (product: Product) => void
}

export function ProductCard({ product, onSelect, onQuickAdd }: ProductCardProps) {
  const activeVariants = (product.variants || []).filter((v) => v.active)
  const hasVariants = activeVariants.length > 0
  const displayPrice = hasVariants
    ? Math.min(...activeVariants.map((v) => v.price))
    : product.price

  return (
    <div
      className="group cursor-pointer rounded-2xl bg-white border border-border overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5"
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(product)
        }
      }}
      aria-label={`Ver ${product.name}, ${hasVariants ? "desde " : ""}${formatPrice(displayPrice)}`}
    >
      {/* Square image area with orange background */}
      <div className="relative aspect-square overflow-hidden bg-primary/10">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      <div className="p-3.5 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="title-case truncate text-sm font-bold leading-snug text-foreground">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
              {product.description}
            </p>
          )}
          <p className="text-base font-extrabold text-primary mt-1.5">
            {hasVariants && (
              <span className="mr-1 text-[11px] font-medium text-muted-foreground/70">Desde</span>
            )}
            {formatPrice(displayPrice)}
          </p>
        </div>
        <Button
          size="icon"
          className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm mt-0.5"
          onClick={(e) => {
            e.stopPropagation()
            // Variants require a choice — open the modal instead of adding blindly
            if (hasVariants) {
              onSelect(product)
            } else {
              onQuickAdd(product)
            }
          }}
          aria-label={hasVariants ? `Elegir opciones de ${product.name}` : `Agregar ${product.name} al carrito`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
