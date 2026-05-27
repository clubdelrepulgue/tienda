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
import Image from "next/image"

interface StorefrontShellProps {
    categories: Category[]
    products: Product[]
    modifierGroups: ModifierGroup[]
}

function HeroBanner() {
    return (
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-3">
            <div className="relative aspect-[1270/352] overflow-hidden rounded-3xl border-2 border-primary/20 shadow-sm shadow-primary/10">
                <Image
                    src="/assets/BANNER 1  BLZR - 1.webp"
                    alt="Hechas a mano. Horneadas con amor."
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) calc(100vw - 32px), 1024px"
                    priority
                />
            </div>
        </div>
    )
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
        toast.success(`${product.name} agregado al carrito`)
    }

    return (
        <div className="min-h-screen bg-[#F7F7F7]">
            <Header onCartOpen={() => setCartOpen(true)} />
            <HeroBanner />
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
