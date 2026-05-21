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
      className="group cursor-pointer rounded-2xl bg-card border border-border overflow-hidden transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
      onClick={() => onSelect(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(product)
        }
      }}
      aria-label={`View ${product.name}, $${product.price.toFixed(2)}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-card-foreground truncate">{product.name}</h3>
          <p className="text-lg font-bold text-primary mt-0.5">
            ${product.price.toFixed(2)}
          </p>
        </div>
        <Button
          size="icon"
          className="shrink-0 h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd(product)
          }}
          aria-label={`Quick add ${product.name} to cart`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
