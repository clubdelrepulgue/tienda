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
    <div className="sticky top-[57px] z-40 border-b border-white/[0.07] bg-background/85 backdrop-blur-xl">
      <ScrollArea className="mx-auto max-w-6xl">
        <div className="flex items-center gap-2.5 px-4 py-3.5 sm:px-5 lg:px-6">
          <button
            onClick={() => onCategoryChange("all")}
            className={cn(
              "shrink-0 rounded-full border px-[18px] py-2.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
              activeCategory === "all"
                ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.22)]"
                : "border-white/[0.06] bg-[#18191d] text-white/75 hover:border-white/[0.12] hover:bg-[#202126] hover:text-white"
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              className={cn(
                "shrink-0 rounded-full border px-[18px] py-2.5 text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                activeCategory === cat.id
                  ? "border-primary bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.22)]"
                  : "border-white/[0.06] bg-[#18191d] text-white/75 hover:border-white/[0.12] hover:bg-[#202126] hover:text-white"
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
