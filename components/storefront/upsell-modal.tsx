"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, Plus, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Product, UpsellRule } from "@/lib/types"
import { useCartStore } from "@/lib/store"
import { toast } from "sonner"

interface UpsellModalProps {
    isOpen: boolean
    onClose: () => void
}

export function UpsellModal({ isOpen, onClose }: UpsellModalProps) {
    const items = useCartStore((s) => s.items)
    const addItem = useCartStore((s) => s.addItem)
    const [products, setProducts] = useState<Product[]>([])
    const [rules, setRules] = useState<UpsellRule[]>([])
    const [suggestions, setSuggestions] = useState<Array<{
        product: Product
        rule: UpsellRule
        discountedPrice: number
    }>>([])

    useEffect(() => {
        // Load products and upsell rules
        Promise.all([
            fetch("/api/admin?type=products").then((r) => r.json()),
            fetch("/api/admin?type=upsells").then((r) => r.json()),
        ])
            .then(([productsData, rulesData]) => {
                setProducts(productsData || [])
                setRules(rulesData || [])
            })
            .catch(() => { })
    }, [])

    useEffect(() => {
        if (!isOpen || items.length === 0 || rules.length === 0 || products.length === 0) {
            setSuggestions([])
            return
        }

        // Get product IDs and category IDs from cart
        const cartProductIds = items.map((i) => i.productId)
        const cartCategoryIds = items.map((i) => {
            const product = products.find((p) => p.id === i.productId)
            return product?.categoryId
        }).filter(Boolean)

        // Find matching upsell rules
        const matchedRules = rules.filter((rule) => {
            // Check if any cart item triggers this rule
            const hasTriggerProduct = rule.triggerProductIds.some((id) =>
                cartProductIds.includes(id)
            )
            const hasTriggerCategory = rule.triggerCategoryIds.some((id) =>
                cartCategoryIds.includes(id)
            )
            return hasTriggerProduct || hasTriggerCategory
        })

        // Sort by priority and get suggestions
        const sortedRules = matchedRules.sort((a, b) => b.priority - a.priority)
        const allSuggestions: Array<{
            product: Product
            rule: UpsellRule
            discountedPrice: number
        }> = []

        for (const rule of sortedRules.slice(0, 2)) { // Max 2 rules
            for (const productId of rule.suggestedProductIds.slice(0, 3)) { // Max 3 products per rule
                const product = products.find((p) => p.id === productId)
                if (product && product.active) {
                    const discountedPrice = rule.discountPercentage > 0
                        ? product.price * (1 - rule.discountPercentage / 100)
                        : product.price

                    // Check if not already in cart
                    const alreadyInCart = items.some((i) => i.productId === productId)
                    if (!alreadyInCart) {
                        allSuggestions.push({
                            product,
                            rule,
                            discountedPrice,
                        })
                    }
                }
            }
        }

        setSuggestions(allSuggestions.slice(0, 4)) // Max 4 total suggestions
    }, [isOpen, items, rules, products])

    const handleAddToCart = (product: Product, discountedPrice: number, rule: UpsellRule) => {
        addItem(product, [], discountedPrice)
        toast.success(`Added ${product.name} with ${rule.discountPercentage}% off!`)
    }

    if (suggestions.length === 0) return null

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md rounded-2xl bg-card border-border p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-5 pb-3">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <DialogTitle
                            className="text-lg font-bold text-card-foreground"
                            style={{ fontFamily: "var(--font-heading)" }}
                        >
                            Complete your order
                        </DialogTitle>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Customers also added these items
                    </p>
                </DialogHeader>

                <ScrollArea className="max-h-[60vh]">
                    <div className="px-5 pb-5 space-y-3">
                        {suggestions.map(({ product, rule, discountedPrice }) => (
                            <div
                                key={`${product.id}-${rule.id}`}
                                className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50"
                            >
                                <div className="relative h-16 w-16 rounded-lg overflow-hidden shrink-0">
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        className="object-cover"
                                        sizes="64px"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm text-card-foreground truncate">
                                        {product.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                        {product.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {rule.discountPercentage > 0 ? (
                                            <>
                                                <span className="text-sm font-bold text-primary">
                                                    ${discountedPrice.toFixed(2)}
                                                </span>
                                                <span className="text-xs text-muted-foreground line-through">
                                                    ${product.price.toFixed(2)}
                                                </span>
                                                <span className="text-xs bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded">
                                                    -{rule.discountPercentage}%
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-bold text-card-foreground">
                                                ${product.price.toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    size="icon"
                                    className="h-9 w-9 rounded-full shrink-0"
                                    onClick={() => handleAddToCart(product, discountedPrice, rule)}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-5 pt-3 border-t border-border">
                    <Button
                        variant="outline"
                        className="w-full rounded-xl"
                        onClick={onClose}
                    >
                        Continue to checkout
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
