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

function Banner() {
    return (
        <div className="w-full">
            <Image
                src="/assets/BANNER 1  BLZR - 1.webp"
                alt="El Club del Repulgue — Banner"
                width={1920}
                height={400}
                className="w-full h-auto"
                priority
            />
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
            <Banner />
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
