"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Minus, Plus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCartStore } from "@/lib/store"
import type { Branch, Product, CartItem, CartItemModifier, ModifierGroup } from "@/lib/types"
import { toast } from "sonner"

interface ProductModalProps {
  product: Product | null
  branch: Branch
  allModifierGroups: ModifierGroup[]
  open: boolean
  onAddItem?: (item: Omit<CartItem, "id">) => void
  addButtonLabel?: string
  successMessage?: (product: Product) => string
  onClose: () => void
}

export function ProductModal({
  product,
  branch,
  allModifierGroups,
  open,
  onAddItem,
  addButtonLabel = "Agregar",
  successMessage,
  onClose,
}: ProductModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<string>("")
  const [note, setNote] = useState("")
  const addItem = useCartStore((s) => s.addItem)

  const activeVariants = useMemo(
    () => (product?.variants || []).filter((v) => v.active),
    [product]
  )
  const hasVariants = activeVariants.length > 0

  // Pick a sensible default variant whenever the product changes
  useEffect(() => {
    if (!product) return
    setSelectedVariantId(activeVariants[0]?.id || "")
    setSelectedModifiers([])
    setQuantity(1)
    setNote("")
  }, [product, activeVariants])

  if (!product) return null

  const productModifierGroups = allModifierGroups.filter((g) =>
    product.modifierGroups.includes(g.id)
  )

  const selectedVariant = activeVariants.find((v) => v.id === selectedVariantId)
  const basePrice = hasVariants
    ? (selectedVariant?.price ?? activeVariants[0]?.price ?? product.price)
    : product.price

  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + m.price, 0)
  const itemTotal = (basePrice + modifiersTotal) * quantity

  const handleToggleModifier = (
    groupId: string,
    groupName: string,
    optionId: string,
    optionName: string,
    price: number,
    maxSelections: number
  ) => {
    setSelectedModifiers((prev) => {
      const existing = prev.find(
        (m) => m.groupId === groupId && m.optionId === optionId
      )
      if (existing) {
        return prev.filter(
          (m) => !(m.groupId === groupId && m.optionId === optionId)
        )
      }

      if (maxSelections === 1) {
        return [
          ...prev.filter((m) => m.groupId !== groupId),
          { groupId, groupName, optionId, optionName, price },
        ]
      }

      const groupCount = prev.filter((m) => m.groupId === groupId).length
      if (groupCount >= maxSelections) return prev

      return [...prev, { groupId, groupName, optionId, optionName, price }]
    })
  }

  const handleAddToCart = () => {
    if (hasVariants && !selectedVariant) {
      toast.error(`Elegí ${product.variantGroupLabel.toLowerCase()}`)
      return
    }

    const item = {
      productId: product.id,
      branchId: branch.id,
      name: product.name,
      image: product.image,
      price: basePrice,
      quantity,
      modifiers: selectedModifiers,
      variantId: selectedVariant?.id,
      variantName: selectedVariant?.name,
      note: note.trim() || undefined,
    }

    if (onAddItem) {
      onAddItem(item)
    } else {
      const result = addItem(item, branch)
      if (!result.success) {
        toast.error(result.error)
        return
      }
    }

    toast.success(successMessage ? successMessage(product) : `${product.name} agregado al carrito`)
    setQuantity(1)
    setSelectedModifiers([])
    setSelectedVariantId(activeVariants[0]?.id || "")
    setNote("")
    onClose()
  }

  const handleClose = () => {
    setQuantity(1)
    setSelectedModifiers([])
    setSelectedVariantId(activeVariants[0]?.id || "")
    setNote("")
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-border bg-white p-0">
        {/* Image header with orange background */}
        <div className="relative aspect-[4/3] overflow-hidden bg-primary/15">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 p-5">
            <DialogTitle
              className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {product.name}
            </DialogTitle>
            {product.description && (
              <p className="max-w-[85%] text-sm text-white/80">
                {product.description}
              </p>
            )}
            <p className="text-xl font-extrabold text-white sm:text-2xl">
              ${basePrice.toFixed(2)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-white/90 text-foreground hover:bg-white shadow-sm"
            onClick={handleClose}
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Modifiers */}
        <div className="product-modal-scroll min-h-0 overflow-y-auto bg-white">
          <div className="flex flex-col gap-5 p-5 pr-6">
            {hasVariants && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-foreground text-sm">
                    {product.variantGroupLabel}
                  </h4>
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                    Requerido
                  </span>
                </div>
                <RadioGroup
                  value={selectedVariantId}
                  onValueChange={setSelectedVariantId}
                >
                  <div className="flex flex-col gap-2">
                    {activeVariants.map((variant) => (
                      <Label
                        key={variant.id}
                        htmlFor={`variant-${variant.id}`}
                        className="flex items-center justify-between rounded-xl bg-secondary border border-border px-4 py-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value={variant.id} id={`variant-${variant.id}`} />
                          <span className="text-sm font-medium text-foreground">
                            {variant.name}
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-primary">
                          ${variant.price.toFixed(2)}
                        </span>
                      </Label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            )}
            {productModifierGroups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-foreground text-sm">
                    {group.name}
                  </h4>
                  {group.required && (
                    <span className="text-xs bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                      Requerido
                    </span>
                  )}
                </div>

                {group.maxSelections === 1 ? (
                  <RadioGroup
                    value={
                      selectedModifiers.find((m) => m.groupId === group.id)
                        ?.optionId || ""
                    }
                    onValueChange={(value) => {
                      const opt = group.options.find((o) => o.id === value)
                      if (opt) {
                        handleToggleModifier(
                          group.id,
                          group.name,
                          opt.id,
                          opt.name,
                          opt.price,
                          1
                        )
                      }
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {group.options.map((option) => (
                        <Label
                          key={option.id}
                          htmlFor={option.id}
                          className="flex items-center justify-between rounded-xl bg-secondary border border-border px-4 py-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <span className="text-sm font-medium text-foreground">
                              {option.name}
                            </span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-sm font-semibold text-primary">
                              +${option.price.toFixed(2)}
                            </span>
                          )}
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <div className="flex flex-col gap-2">
                    {group.options.map((option) => {
                      const isChecked = selectedModifiers.some(
                        (m) =>
                          m.groupId === group.id && m.optionId === option.id
                      )
                      return (
                        <Label
                          key={option.id}
                          htmlFor={`check-${option.id}`}
                          className="flex items-center justify-between rounded-xl bg-secondary border border-border px-4 py-3 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={`check-${option.id}`}
                              checked={isChecked}
                              onCheckedChange={() =>
                                handleToggleModifier(
                                  group.id,
                                  group.name,
                                  option.id,
                                  option.name,
                                  option.price,
                                  group.maxSelections
                                )
                              }
                            />
                            <span className="text-sm font-medium text-foreground">
                              {option.name}
                            </span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-sm font-semibold text-primary">
                              +${option.price.toFixed(2)}
                            </span>
                          )}
                        </Label>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}

            {/* Optional per-item comment */}
            <div>
              <h4 className="font-bold text-foreground text-sm mb-3">
                Comentario{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </h4>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej: sin cebolla, bien cocida, cortar al medio…"
                maxLength={200}
                className="min-h-16 resize-none rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Add to cart footer */}
        <div className="p-5 border-t border-border flex items-center gap-4 bg-secondary/50">
          <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-1 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-primary/10"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              aria-label="Disminuir"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm font-bold w-6 text-center text-foreground">
              {quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-primary/10"
              onClick={() => setQuantity(quantity + 1)}
              aria-label="Aumentar"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="flex-1 h-11 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold shadow-sm"
            onClick={handleAddToCart}
          >
            {addButtonLabel} — ${itemTotal.toFixed(2)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
