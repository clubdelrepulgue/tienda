"use client"

import { useState } from "react"
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
import { useCartStore } from "@/lib/store"
import type { Product, CartItemModifier, ModifierGroup } from "@/lib/types"
import { toast } from "sonner"

interface ProductModalProps {
  product: Product | null
  allModifierGroups: ModifierGroup[]
  open: boolean
  onClose: () => void
}

export function ProductModal({ product, allModifierGroups, open, onClose }: ProductModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([])
  const addItem = useCartStore((s) => s.addItem)

  if (!product) return null

  const productModifierGroups = allModifierGroups.filter((g) =>
    product.modifierGroups.includes(g.id)
  )

  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + m.price, 0)
  const itemTotal = (product.price + modifiersTotal) * quantity

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
    addItem({
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity,
      modifiers: selectedModifiers,
    })
    toast.success(`${product.name} added to cart`)
    setQuantity(1)
    setSelectedModifiers([])
    onClose()
  }

  const handleClose = () => {
    setQuantity(1)
    setSelectedModifiers([])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="grid max-h-[90vh] max-w-lg grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-2xl border-border bg-card p-0">
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 via-28% to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-2 p-5">
            <DialogTitle
              className="text-3xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {product.name}
            </DialogTitle>
            <p className="max-w-[85%] text-sm leading-relaxed text-white/70 sm:text-base">
              {product.description}
            </p>
            <p className="text-2xl font-bold text-primary sm:text-3xl">
              ${product.price.toFixed(2)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-background/80 text-foreground backdrop-blur-sm hover:bg-background"
            onClick={handleClose}
            aria-label="Close product details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="product-modal-scroll min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-5 p-5 pr-6">
            {productModifierGroups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-card-foreground text-sm">
                    {group.name}
                  </h4>
                  {group.required && (
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                      Required
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
                          className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3 cursor-pointer hover:bg-secondary transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <span className="text-sm text-card-foreground">
                              {option.name}
                            </span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-sm text-muted-foreground">
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
                          className="flex items-center justify-between rounded-xl bg-secondary/50 px-4 py-3 cursor-pointer hover:bg-secondary transition-colors"
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
                            <span className="text-sm text-card-foreground">
                              {option.name}
                            </span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-sm text-muted-foreground">
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
          </div>
        </div>

        <div className="p-5 border-t border-border flex items-center gap-4">
          <div className="flex items-center gap-3 bg-secondary rounded-xl px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              aria-label="Decrease quantity"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold w-6 text-center text-foreground">
              {quantity}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => setQuantity(quantity + 1)}
              aria-label="Increase quantity"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            onClick={handleAddToCart}
          >
            Add to Cart - ${itemTotal.toFixed(2)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
