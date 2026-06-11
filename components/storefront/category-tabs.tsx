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
    <div className="sticky top-[57px] z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <ScrollArea className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2.5 px-4 py-2 sm:px-5 lg:px-6">
          <button
            onClick={() => onCategoryChange("all")}
            className={cn(
              "shrink-0 rounded-full border px-[18px] py-2.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
              activeCategory === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(232,99,3,0.22)]"
                : "border-border bg-background text-foreground/75 hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
            )}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-[18px] py-2.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                activeCategory === cat.id
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(232,99,3,0.22)]"
                  : "border-border bg-background text-foreground/75 hover:border-primary/20 hover:bg-primary/5 hover:text-foreground"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
