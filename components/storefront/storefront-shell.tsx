"use client"

import { useState } from "react"
import { Header } from "@/components/storefront/header"
import { CategoryTabs } from "@/components/storefront/category-tabs"
import { ProductGrid } from "@/components/storefront/product-grid"
import { ProductModal } from "@/components/storefront/product-modal"
import { CartSheet } from "@/components/storefront/cart-sheet"
import { FloatingCart } from "@/components/storefront/floating-cart"
import { useCartStore } from "@/lib/store"
import type { Product, Category, ModifierGroup } from "@/lib/types"
import { toast } from "sonner"

interface StorefrontShellProps {
    categories: Category[]
    products: Product[]
    modifierGroups: ModifierGroup[]
}

export function StorefrontShell({
    categories,
    products,
    modifierGroups,
}: StorefrontShellProps) {
    const [activeCategory, setActiveCategory] = useState("all")
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [productModalOpen, setProductModalOpen] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)
    const addItem = useCartStore((s) => s.addItem)

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product)
        setProductModalOpen(true)
    }

    const handleQuickAdd = (product: Product) => {
        addItem({
            productId: product.id,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity: 1,
            modifiers: [],
        })
        toast.success(`${product.name} added to cart`)
    }

    return (
        <div className="min-h-screen bg-background">
            <Header onCartOpen={() => setCartOpen(true)} />
            <CategoryTabs
                categories={categories}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />
            <ProductGrid
                products={products}
                categories={categories}
                activeCategory={activeCategory}
                onSelectProduct={handleSelectProduct}
                onQuickAdd={handleQuickAdd}
            />
            <ProductModal
                product={selectedProduct}
                allModifierGroups={modifierGroups}
                open={productModalOpen}
                onClose={() => {
                    setProductModalOpen(false)
                    setSelectedProduct(null)
                }}
            />
            <CartSheet open={cartOpen} onClose={() => setCartOpen(false)} />
            <FloatingCart onCartOpen={() => setCartOpen(true)} />
        </div>
    )
}
