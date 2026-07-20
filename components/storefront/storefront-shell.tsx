"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/storefront/header"
import { CategoryTabs } from "@/components/storefront/category-tabs"
import { ProductGrid } from "@/components/storefront/product-grid"
import { ProductModal } from "@/components/storefront/product-modal"
import { CartSheet } from "@/components/storefront/cart-sheet"
import { FloatingCart } from "@/components/storefront/floating-cart"
import { ReorderBanner } from "@/components/storefront/reorder-banner"
import { useCartStore } from "@/lib/store"
import { formatSnapshotAge, menuSnapshots } from "@/lib/offline-storage"
import { useConnectivity } from "@/hooks/use-connectivity"
import type { Branch, Product, Category, ModifierGroup, UpsellRule } from "@/lib/types"
import { applyBranchThemeVars, DEFAULT_BRAND_COLOR } from "@/lib/active-branch"
import { toast } from "sonner"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { CSSProperties } from "react"

interface StorefrontShellProps {
    branch: Branch
    categories: Category[]
    products: Product[]
    modifierGroups: ModifierGroup[]
    upsellRules: UpsellRule[]
}

function Banner({ branch }: { branch: Branch }) {
    const bannerUrl = branch.bannerUrl || "/assets/BANNER 1  BLZR - 1.webp"
    const hasHeroCopy = !!(branch.heroTitle || branch.heroSubtitle)

    return (
        <section className="px-4 py-[5px] sm:px-6">
            <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl">
                <Image
                    src={bannerUrl}
                    alt={`${branch.name} — Banner`}
                    width={1920}
                    height={400}
                    className="block h-auto w-full"
                    priority
                />
                {hasHeroCopy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/15 px-6 text-center text-white">
                        <div className="max-w-3xl">
                            {branch.heroSubtitle && (
                                <p className="mb-2 inline-block rounded-sm bg-black/35 px-3 py-1 text-sm font-semibold sm:text-base">
                                    {branch.heroSubtitle}
                                </p>
                            )}
                            {branch.heroTitle && (
                                <h2
                                    className="text-3xl font-extrabold tracking-tight drop-shadow sm:text-5xl"
                                    style={{ fontFamily: "var(--font-heading)" }}
                                >
                                    {branch.heroTitle}
                                </h2>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

export function StorefrontShell({
    branch: initialBranch,
    categories: initialCategories,
    products: initialProducts,
    modifierGroups: initialModifierGroups,
    upsellRules: initialUpsellRules,
}: StorefrontShellProps) {
    const [menuData, setMenuData] = useState({
        branch: initialBranch,
        categories: initialCategories,
        products: initialProducts,
        modifierGroups: initialModifierGroups,
        upsellRules: initialUpsellRules,
    })
    const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<number | null>(null)
    const isOnline = useConnectivity()
    const { branch, categories, products, modifierGroups, upsellRules } = menuData
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
        let cancelled = false

        async function hydrateOfflineMenu() {
            try {
                if (isOnline && (initialProducts.length > 0 || initialCategories.length > 0)) {
                    await menuSnapshots.save({
                        branch: initialBranch,
                        categories: initialCategories,
                        products: initialProducts,
                        modifierGroups: initialModifierGroups,
                        upsellRules: initialUpsellRules,
                    })
                    if (!cancelled) setSnapshotUpdatedAt(Date.now())
                    return
                }

                const snapshot = await menuSnapshots.read(initialBranch.slug)
                if (snapshot && !cancelled) {
                    setMenuData(snapshot)
                    setSnapshotUpdatedAt(snapshot.updatedAt)
                }
            } catch {
                // Cache storage is an enhancement; the live menu remains usable.
            }
        }

        hydrateOfflineMenu()
        return () => { cancelled = true }
    }, [
        initialBranch,
        initialCategories,
        initialModifierGroups,
        initialProducts,
        initialUpsellRules,
        isOnline,
    ])

    useEffect(() => {
        const result = setBranchContext(branch)
        setBranchBlocked(!result.success)
    }, [branch, setBranchContext])

    useEffect(() => {
        applyBranchThemeVars(document.documentElement, branch)
    }, [branch])

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

    const branchStyle = {
        "--primary": branch.brandColor || DEFAULT_BRAND_COLOR,
        "--ring": branch.brandColor || DEFAULT_BRAND_COLOR,
        "--chart-1": branch.brandColor || DEFAULT_BRAND_COLOR,
        "--accent": branch.accentColor || "oklch(0.97 0 0)",
    } as CSSProperties

    return (
        <div
            className="flex min-h-dvh flex-col bg-[#F7F7F7] [--storefront-header-height:73px]"
            style={branchStyle}
        >
            <Header branch={branch} onCartOpen={() => setCartOpen(true)} />
            {!isOnline && snapshotUpdatedAt && (
                <div className="bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
                    Menú guardado · actualizado {formatSnapshotAge(snapshotUpdatedAt)}
                </div>
            )}
            <Banner branch={branch} />
            <ReorderBanner
                branch={branch}
                products={products}
                modifierGroups={modifierGroups}
                onReordered={() => setCartOpen(true)}
            />
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
            <CartSheet
                open={cartOpen}
                onClose={() => setCartOpen(false)}
                products={products}
                upsellRules={upsellRules}
            />
            <FloatingCart onCartOpen={() => setCartOpen(true)} />
        </div>
    )
}
