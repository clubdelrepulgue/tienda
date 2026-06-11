"use client"

import { ProductCard } from "./product-card"
import type { Product, Category } from "@/lib/types"

interface ProductGridProps {
  products: Product[]
  categories: Category[]
  activeCategory: string
  onSelectProduct: (product: Product) => void
  onQuickAdd: (product: Product) => void
}

export function ProductGrid({
  products,
  categories,
  activeCategory,
  onSelectProduct,
  onQuickAdd,
}: ProductGridProps) {
  const filteredProducts =
    activeCategory === "all"
      ? products.filter((p) => p.active)
      : products.filter((p) => p.active && p.categoryId === activeCategory)

  const groupedByCategory = categories
    .map((cat) => ({
      category: cat,
      items: filteredProducts.filter((p) => p.categoryId === cat.id),
    }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-32 flex flex-col gap-10">
      {groupedByCategory.map(({ category, items }, idx) => (
        <section key={category.id} id={`category-${category.slug}`}>
          <div className="flex items-center gap-2 mb-5">
            {idx === 0 && (
              <span className="text-2xl" role="img" aria-label="empanada">🥟</span>
            )}
            <h2
              className="text-xl font-extrabold text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {idx === 0 ? "Nuestras Empanadas" : category.name}
            </h2>
            {idx === 0 && (
              <div className="flex-1 border-b-2 border-primary ml-1 mb-0.5" style={{ maxWidth: "48px" }} />
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
