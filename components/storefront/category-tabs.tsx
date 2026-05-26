"use client"

import { cn } from "@/lib/utils"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { Category } from "@/lib/types"

interface CategoryTabsProps {
  categories: Category[]
  activeCategory: string
  onCategoryChange: (categoryId: string) => void
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  return (
    <div className="sticky top-[84px] z-40 bg-white border-b border-border">
      <ScrollArea className="mx-auto max-w-5xl">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => onCategoryChange("all")}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all whitespace-nowrap",
              activeCategory === "all"
                ? "bg-primary text-white"
                : "bg-white text-foreground border border-border hover:border-primary/40 hover:text-primary"
            )}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all whitespace-nowrap",
                activeCategory === cat.id
                  ? "bg-primary text-white"
                  : "bg-white text-foreground border border-border hover:border-primary/40 hover:text-primary"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>
    </div>
  )
}
