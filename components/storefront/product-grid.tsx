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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-6 pb-32">
      {groupedByCategory.map(({ category, items }, idx) => (
        <section key={category.id} id={`category-${category.slug}`}>
          <h2
            className="title-case mb-5 text-xl font-extrabold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {category.name}
          </h2>
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
