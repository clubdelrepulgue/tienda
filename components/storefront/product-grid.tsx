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
    <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-8">
      {groupedByCategory.map(({ category, items }) => (
        <section key={category.id} id={`category-${category.slug}`}>
          <h2
            className="text-lg font-bold mb-4 text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {category.name}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
