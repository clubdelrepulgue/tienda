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

function HeroBanner({ products }: { products: Product[] }) {
    const heroProduct = products.find((p) => p.active) ?? null

    return (
        <div className="mx-auto max-w-5xl px-4 pt-5 pb-3">
            <div className="relative rounded-3xl bg-primary overflow-hidden min-h-[200px] sm:min-h-[240px] flex items-center">
                {/* Left content */}
                <div className="relative z-10 flex-1 px-7 py-8 sm:px-10">
                    {/* Decorative sparks */}
                    <div className="flex gap-2 mb-4">
                        <svg width="20" height="20" viewBox="0 0 20 20" className="text-yellow-300" fill="currentColor" aria-hidden>
                            <path d="M10 0l1.8 6.8L18 10l-6.2 3.2L10 20l-1.8-6.8L2 10l6.2-3.2z" />
                        </svg>
                        <svg width="14" height="14" viewBox="0 0 20 20" className="text-yellow-300 mt-1" fill="currentColor" aria-hidden>
                            <path d="M10 0l1.8 6.8L18 10l-6.2 3.2L10 20l-1.8-6.8L2 10l6.2-3.2z" />
                        </svg>
                    </div>
                    <h2
                        className="text-3xl sm:text-4xl font-extrabold text-white leading-tight"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Hechas a mano.
                        <br />
                        Horneadas con amor.
                    </h2>
                    <p className="mt-3 text-white/80 text-sm sm:text-base">
                        Masa crujiente, rellenos increíbles.{" "}
                        <br className="hidden sm:block" />
                        Bienvenido al{" "}
                        <span className="text-yellow-200 font-semibold">Club del Repulgue.</span>
                    </p>
                </div>

                {/* Right — empanada image */}
                <div className="shrink-0 w-52 sm:w-72 h-48 sm:h-64 relative">
                    {heroProduct?.image ? (
                        <Image
                            src={heroProduct.image}
                            alt="Empanada"
                            fill
                            className="object-contain object-center drop-shadow-2xl"
                            sizes="(max-width: 640px) 208px, 288px"
                            priority
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <span className="text-8xl" role="img" aria-label="empanada">🥟</span>
                        </div>
                    )}
                </div>

                {/* Badge */}
                <div className="absolute top-4 right-4 sm:top-6 sm:right-6 h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-white flex flex-col items-center justify-center text-center shadow-lg">
                    <span className="text-primary font-extrabold text-[10px] sm:text-xs leading-tight">100%</span>
                    <span className="text-primary font-bold text-[9px] sm:text-[10px] leading-tight">Hechas</span>
                    <span className="text-primary font-bold text-[9px] sm:text-[10px] leading-tight">a mano</span>
                    <span className="text-xl mt-0.5">🤍</span>
                </div>
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
            <HeroBanner products={products} />
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
