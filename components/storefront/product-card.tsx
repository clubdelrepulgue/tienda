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
      className="group cursor-pointer overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#111214] shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-[#141518] hover:shadow-[0_18px_48px_rgba(0,0,0,0.3)] focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
      <div className="relative aspect-square w-full overflow-hidden rounded-t-[22px] bg-[#111]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>
      <div className="flex min-h-[78px] items-center justify-between gap-4 px-4 py-3">
        <div className="flex-1 min-w-0">
          <h3 className="mb-1.5 truncate text-[15px] font-bold leading-tight text-white">{product.name}</h3>
          <p className="text-[17px] font-extrabold leading-none text-primary">
            ${product.price.toFixed(2)}
          </p>
        </div>
        <Button
          size="icon"
          className="h-[38px] w-[38px] min-w-[38px] shrink-0 rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.28)] transition-[transform,background-color,box-shadow] duration-150 hover:scale-[1.06] hover:bg-primary/90 hover:shadow-[0_12px_28px_rgba(255,56,56,0.36)] active:scale-95"
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
