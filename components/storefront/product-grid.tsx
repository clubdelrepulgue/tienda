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
    <div className="mx-auto flex max-w-6xl flex-col gap-9 px-4 pb-28 pt-6 sm:px-5 md:pb-10 lg:px-6">
      {groupedByCategory.map(({ category, items }) => (
        <section key={category.id} id={`category-${category.slug}`}>
          <h2
            className="mb-4 text-lg font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {category.name}
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:gap-[18px] lg:grid-cols-3">
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
