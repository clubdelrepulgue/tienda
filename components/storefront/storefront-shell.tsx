"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/storefront/header"
import { CategoryTabs } from "@/components/storefront/category-tabs"
import { ProductGrid } from "@/components/storefront/product-grid"
import { ProductModal } from "@/components/storefront/product-modal"
import { CartSheet } from "@/components/storefront/cart-sheet"
import { FloatingCart } from "@/components/storefront/floating-cart"
import { useCartStore } from "@/lib/store"
import type { Branch, Product, Category, ModifierGroup } from "@/lib/types"
import { toast } from "sonner"
import Image from "next/image"
import { Button } from "@/components/ui/button"

interface StorefrontShellProps {
    branch: Branch
    categories: Category[]
    products: Product[]
    modifierGroups: ModifierGroup[]
}

function Banner() {
    return (
        <section className="border-b border-border px-4 py-[5px] sm:px-6">
            <Image
                src="/assets/BANNER 1  BLZR - 1.webp"
                alt="El Club del Repulgue — Banner"
                width={1920}
                height={400}
                className="mx-auto block h-auto w-full max-w-6xl rounded-2xl"
                priority
            />
        </section>
    )
}

export function StorefrontShell({
    branch,
    categories,
    products,
    modifierGroups,
}: StorefrontShellProps) {
    const [activeCategory, setActiveCategory] = useState("all")
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [productModalOpen, setProductModalOpen] = useState(false)
    const [cartOpen, setCartOpen] = useState(false)
    const addItem = useCartStore((s) => s.addItem)
    const clearCartAndSetBranch = useCartStore((s) => s.clearCartAndSetBranch)
    const setBranchContext = useCartStore((s) => s.setBranchContext)
    const cartBranchId = useCartStore((s) => s.branchId)
    const cartBranchName = useCartStore((s) => s.branchName)
    const cartItems = useCartStore((s) => s.items)
    const [branchBlocked, setBranchBlocked] = useState(false)

    useEffect(() => {
        const result = setBranchContext(branch)
        setBranchBlocked(!result.success)
    }, [branch, setBranchContext])

    const handleSelectProduct = (product: Product) => {
        if (branchBlocked) {
            toast.error("Vacia el carrito para cambiar de sucursal")
            return
        }
        setSelectedProduct(product)
        setProductModalOpen(true)
    }

    const handleQuickAdd = (product: Product) => {
        const result = addItem({
            productId: product.id,
            branchId: branch.id,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity: 1,
            modifiers: [],
        }, branch)
        if (!result.success) {
            toast.error(result.error)
            setBranchBlocked(true)
            return
        }
        toast.success(`${product.name} agregado al carrito`)
    }

    return (
        <div className="flex min-h-dvh flex-col bg-[#F7F7F7]">
            <Header branch={branch} onCartOpen={() => setCartOpen(true)} />
            <Banner />
            {branchBlocked && cartItems.length > 0 && cartBranchId !== branch.id && (
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:px-6">
                    <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p>
                            Tu carrito pertenece a {cartBranchName || "otra sucursal"}. Para pedir en {branch.name}, primero vacialo.
                        </p>
                        <Button
                            size="sm"
                            variant="outline"
                            className="w-fit rounded-full border-amber-300 bg-white"
                            onClick={() => {
                                clearCartAndSetBranch(branch)
                                setBranchBlocked(false)
                                toast.success(`Carrito listo para ${branch.name}`)
                            }}
                        >
                            Vaciar y usar {branch.name}
                        </Button>
                    </div>
                </div>
            )}
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
                branch={branch}
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
