"use client"

import Image from "next/image"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Product } from "@/lib/types"

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
  onQuickAdd: (product: Product) => void
}

export function ProductCard({ product, onSelect, onQuickAdd }: ProductCardProps) {
  return (
    <div
      className="group cursor-pointer rounded-2xl bg-white border border-primary/15 overflow-hidden shadow-sm transition-all hover:shadow-md hover:border-primary/35 hover:-translate-y-0.5"
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(product)
        }
      }}
      aria-label={`Ver ${product.name}, $${product.price.toFixed(2)}`}
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

      <div className="p-3.5 flex items-start justify-between gap-2 border-t border-primary/10">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm leading-snug truncate">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
          <p className="text-base font-extrabold text-primary mt-1.5">
            ${product.price.toFixed(2)}
          </p>
        </div>
        <Button
          size="icon"
          className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm mt-0.5"
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd(product)
          }}
          aria-label={`Agregar ${product.name} al carrito`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
