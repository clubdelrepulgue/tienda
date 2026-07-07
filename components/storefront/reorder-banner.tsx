"use client"

import { useEffect, useMemo, useState } from "react"
import { History, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useCartStore, useOrderHistoryStore } from "@/lib/store"
import type { Branch, CartItemModifier, ModifierGroup, Order, Product } from "@/lib/types"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

interface ReorderBannerProps {
    branch: Branch
    products: Product[]
    modifierGroups: ModifierGroup[]
    onReordered: () => void
}

// "Pedir de nuevo" without login: the browser keeps the tracking tokens of
// its own past orders, and the token is the access credential. A future
// social login can replace this list with a server-side history lookup.
export function ReorderBanner({ branch, products, modifierGroups, onReordered }: ReorderBannerProps) {
    const orders = useOrderHistoryStore((s) => s.orders)
    const addItem = useCartStore((s) => s.addItem)
    const cartItems = useCartStore((s) => s.items)
    const [loading, setLoading] = useState(false)
    // Avoid SSR/client hydration mismatch: history only exists client-side
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const lastOrder = useMemo(
        () => orders.find((o) => o.branchId === branch.id) || null,
        [orders, branch.id]
    )

    if (!mounted || !lastOrder || cartItems.length > 0) return null

    const handleReorder = async () => {
        setLoading(true)
        try {
            const response = await fetch(`/api/order/${encodeURIComponent(lastOrder.token)}`)
            if (!response.ok) {
                toast.error("No pudimos recuperar tu último pedido")
                return
            }

            const order = (await response.json()) as Order

            let added = 0
            let skipped = 0

            for (const item of order.items) {
                // Rebuild each line against the CURRENT menu: current prices,
                // and skip anything that no longer exists or was deactivated.
                const product = products.find((p) => p.id === item.productId && p.active)
                if (!product) {
                    skipped++
                    continue
                }

                let price = product.price
                let variantId: string | undefined
                let variantName: string | undefined

                if (item.variantName) {
                    const variant = (product.variants || []).find(
                        (v) => v.active && v.name === item.variantName
                    )
                    if (!variant) {
                        skipped++
                        continue
                    }
                    price = variant.price
                    variantId = variant.id
                    variantName = variant.name
                } else if ((product.variants || []).some((v) => v.active)) {
                    // Product gained variants since that order — needs a choice now
                    skipped++
                    continue
                }

                const modifiers: CartItemModifier[] = []
                for (const modifier of item.modifiers || []) {
                    const group = modifierGroups.find((g) => g.id === modifier.groupId)
                    const option = group?.options.find((o) => o.id === modifier.optionId)
                    if (group && option) {
                        modifiers.push({
                            groupId: group.id,
                            groupName: group.name,
                            optionId: option.id,
                            optionName: option.name,
                            price: option.price,
                        })
                    }
                }

                const result = addItem(
                    {
                        productId: product.id,
                        branchId: branch.id,
                        name: product.name,
                        image: product.image,
                        price,
                        quantity: item.quantity,
                        modifiers,
                        variantId,
                        variantName,
                        note: item.note,
                    },
                    branch
                )

                if (result.success) added++
                else {
                    toast.error(result.error || "No se pudo agregar el producto")
                    return
                }
            }

            if (added === 0) {
                toast.error("Los productos de tu último pedido ya no están disponibles")
                return
            }

            if (skipped > 0) {
                toast.info(`${skipped} producto${skipped > 1 ? "s" : ""} de tu pedido anterior ya no est${skipped > 1 ? "án" : "á"} disponible${skipped > 1 ? "s" : ""}`)
            }

            toast.success("¡Tu pedido anterior está en el carrito!")
            onReordered()
        } catch {
            toast.error("No pudimos recuperar tu último pedido")
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="px-4 pb-1 sm:px-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <History className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-foreground">¿Lo de siempre?</p>
                        <p className="text-xs text-muted-foreground">
                            Repetí tu último pedido
                            {lastOrder.itemCount > 0 && ` · ${lastOrder.itemCount} producto${lastOrder.itemCount > 1 ? "s" : ""}`}
                            {lastOrder.total > 0 && ` · ${formatPrice(lastOrder.total)}`}
                        </p>
                    </div>
                </div>
                <Button
                    size="sm"
                    onClick={handleReorder}
                    disabled={loading}
                    className="w-fit rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    {loading ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                        <RotateCcw className="mr-1.5 h-4 w-4" />
                    )}
                    Pedir de nuevo
                </Button>
            </div>
        </section>
    )
}
