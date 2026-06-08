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
      className="group min-w-0 cursor-pointer overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111214] shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-[#141518] hover:shadow-[0_18px_48px_rgba(0,0,0,0.3)] focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:rounded-[22px]"
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
      <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-[#111] sm:rounded-t-[22px]">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>
      <div className="flex min-h-[64px] items-center justify-between gap-2.5 px-3 py-2.5 sm:min-h-[78px] sm:gap-4 sm:px-4 sm:py-3">
        <div className="flex-1 min-w-0">
          <h3 className="mb-1 truncate text-sm font-bold leading-tight text-white sm:mb-1.5 sm:text-[15px]">{product.name}</h3>
          <p className="text-[15px] font-extrabold leading-none text-primary sm:text-[17px]">
            ${product.price.toFixed(2)}
          </p>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 min-w-8 shrink-0 rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.28)] transition-[transform,background-color,box-shadow] duration-150 hover:scale-[1.06] hover:bg-primary/90 hover:shadow-[0_12px_28px_rgba(255,56,56,0.36)] active:scale-95 sm:h-[38px] sm:w-[38px] sm:min-w-[38px]"
          onClick={(e) => {
            e.stopPropagation()
            onQuickAdd(product)
          }}
          aria-label={`Agregar rapido ${product.name} al carrito`}
        >
          <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </Button>
      </div>
    </div>
  )
}
