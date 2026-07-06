"use client"

import { useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/store"
import type { Product, UpsellRule } from "@/lib/types"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

type CartSuggestion = {
  product: Product
  rule: UpsellRule
  discountedPrice: number
}

interface CartSheetProps {
  open: boolean
  onClose: () => void
  products: Product[]
  upsellRules: UpsellRule[]
}

export function CartSheet({ open, onClose, products, upsellRules }: CartSheetProps) {
  const items = useCartStore((s) => s.items)
  const addItem = useCartStore((s) => s.addItem)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const totalPrice = useCartStore((s) => s.totalPrice())
  const branchSlug = useCartStore((s) => s.branchSlug)
  const suggestions = useMemo<CartSuggestion[]>(() => {
    if (items.length === 0 || products.length === 0 || upsellRules.length === 0) {
      return []
    }

    const productsById = new Map(products.map((product) => [product.id, product]))
    const cartProductIds = new Set(items.map((item) => item.productId))
    const cartCategoryIds = new Set(
      items
        .map((item) => productsById.get(item.productId)?.categoryId)
        .filter((categoryId): categoryId is string => Boolean(categoryId))
    )
    const seenSuggestions = new Set<string>()

    return upsellRules
      .filter((rule) => rule.isActive)
      .filter((rule) => {
        const hasTriggerProduct = rule.triggerProductIds.some((id) => cartProductIds.has(id))
        const hasTriggerCategory = rule.triggerCategoryIds.some((id) => cartCategoryIds.has(id))

        return hasTriggerProduct || hasTriggerCategory
      })
      .sort((a, b) => b.priority - a.priority)
      .flatMap((rule) =>
        rule.suggestedProductIds.map((productId) => {
          const product = productsById.get(productId)
          const productHasVariants = (product?.variants || []).some((v) => v.active)
          if (!product || !product.active || productHasVariants || cartProductIds.has(productId) || seenSuggestions.has(productId)) {
            return null
          }

          seenSuggestions.add(productId)
          const discountPercentage = Math.max(rule.discountPercentage || 0, 0)
          const discountedPrice =
            discountPercentage > 0
              ? product.price * (1 - discountPercentage / 100)
              : product.price

          return {
            product,
            rule,
            discountedPrice,
          }
        })
      )
      .filter((suggestion): suggestion is CartSuggestion => Boolean(suggestion))
      .slice(0, 3)
  }, [items, products, upsellRules])
  const hasDiscountedSuggestions = suggestions.some(
    ({ rule }) => rule.discountPercentage > 0
  )

  const handleAddSuggestion = ({ product, discountedPrice }: CartSuggestion) => {
    const result = addItem({
      productId: product.id,
      branchId: product.branchId,
      name: product.name,
      image: product.image,
      price: discountedPrice,
      quantity: 1,
      modifiers: [],
    })

    if (!result.success) {
      toast.error(result.error)
      return
    }

    toast.success(`${product.name} agregado al carrito`)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col bg-white border-border">
        <SheetHeader className="p-5 border-b border-border">
          <SheetTitle
            className="text-lg font-bold text-foreground flex items-center gap-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <ShoppingBag className="h-5 w-5 text-primary" />
            Tu Carrito ({items.length})
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm font-medium">Tu carrito está vacío</p>
            <Button
              className="rounded-full bg-primary text-white hover:bg-primary/90 px-5"
              size="sm"
              onClick={onClose}
            >
              Ver menú
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1">
              <div className="p-5 flex flex-col gap-4">
                {items.map((item) => {
                  const modPrice = item.modifiers.reduce(
                    (sum, m) => sum + m.price,
                    0
                  )
                  const lineTotal = (item.price + modPrice) * item.quantity
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-primary/10">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="title-case truncate text-sm font-semibold text-foreground">
                            {item.name}
                            {item.variantName && (
                              <span className="text-muted-foreground font-normal"> · {item.variantName}</span>
                            )}
                          </h4>
                          <span className="text-sm font-bold text-primary shrink-0">
                            {formatPrice(lineTotal)}
                          </span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.modifiers.map((m) => m.optionName).join(", ")}
                          </p>
                        )}
                        {item.note && (
                          <p className="text-xs text-muted-foreground/90 italic mt-0.5 line-clamp-2">
                            “{item.note}”
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex items-center gap-1 bg-secondary rounded-lg border border-border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10"
                              onClick={() =>
                                updateQty(item.id, item.quantity - 1)
                              }
                              aria-label="Disminuir cantidad"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="text-xs font-bold w-5 text-center text-foreground">
                              {item.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg hover:bg-primary/10"
                              onClick={() =>
                                updateQty(item.id, item.quantity + 1)
                              }
                              aria-label="Aumentar cantidad"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                            onClick={() => removeItem(item.id)}
                            aria-label={`Eliminar ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {suggestions.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-extrabold text-foreground">
                          {hasDiscountedSuggestions ? "Descuentos para sumar" : "También podés sumar"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Promos disponibles por tu carrito
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      {suggestions.map((suggestion) => {
                        const { product, rule, discountedPrice } = suggestion
                        const hasDiscount = rule.discountPercentage > 0

                        return (
                          <div
                            key={`${rule.id}-${product.id}`}
                            className="flex items-center gap-3 rounded-xl border border-primary/15 bg-primary/5 p-3"
                          >
                            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-primary/10">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                                sizes="56px"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="title-case truncate text-sm font-bold text-foreground">
                                  {product.name}
                                </p>
                                {hasDiscount && (
                                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-white">
                                    -{rule.discountPercentage}%
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="text-sm font-extrabold text-primary">
                                  {formatPrice(discountedPrice)}
                                </span>
                                {hasDiscount && (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {formatPrice(product.price)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full bg-primary text-white hover:bg-primary/90"
                              onClick={() => handleAddSuggestion(suggestion)}
                              aria-label={`Agregar ${product.name} con descuento`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border p-5 flex flex-col gap-4 bg-secondary/50">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Subtotal</span>
                <span className="text-xl font-extrabold text-foreground">
                  {formatPrice(totalPrice)}
                </span>
              </div>
              <Separator />
              <Button
                className="w-full h-12 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold text-base shadow-sm"
                asChild
                onClick={onClose}
              >
                <Link href={branchSlug ? `/checkout?branch=${branchSlug}` : "/checkout"}>
                  Ir al checkout
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
