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
import type { Product, CartItem, CartItemModifier, ModifierGroup } from "@/lib/types"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

interface ProductModalProps {
  product: Product | null
  allModifierGroups: ModifierGroup[]
  open: boolean
  onClose: () => void
  onAddItem?: (item: Omit<CartItem, "id">) => void
  addButtonLabel?: string
  successMessage?: (product: Product) => string
}

export function ProductModal({
  product,
  allModifierGroups,
  open,
  onClose,
  onAddItem,
  addButtonLabel = "Agregar al carrito",
  successMessage = (item) => `${item.name} agregado al carrito`,
}: ProductModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [selectedModifiers, setSelectedModifiers] = useState<CartItemModifier[]>([])
  const addItem = useCartStore((s) => s.addItem)

  if (!product) return null

  const productModifierGroups = allModifierGroups.filter((g) =>
    product.modifierGroups.includes(g.id) && g.options.length > 0
  )

  const modifiersTotal = selectedModifiers.reduce((sum, m) => sum + m.price, 0)
  const itemTotal = (product.price + modifiersTotal) * quantity
  const missingRequiredGroup = productModifierGroups.find(
    (group) =>
      group.required && !selectedModifiers.some((m) => m.groupId === group.id)
  )

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
    if (missingRequiredGroup) {
      toast.error(`Selecciona una opcion de ${missingRequiredGroup.name}`)
      return
    }

    const cartItem = {
      productId: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity,
      modifiers: selectedModifiers,
    }

    if (onAddItem) {
      onAddItem(cartItem)
    } else {
      addItem(cartItem)
    }

    toast.success(successMessage(product))
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
      <DialogContent
        showCloseButton={false}
        className="grid gap-0 overflow-hidden border-border bg-card p-0 max-sm:fixed max-sm:inset-0 max-sm:!top-0 max-sm:!left-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:grid-rows-[auto_minmax(0,1fr)_auto] max-sm:rounded-none max-sm:border-0 sm:max-h-[90vh] sm:max-w-lg sm:grid-rows-[auto_minmax(0,1fr)_auto] sm:rounded-2xl"
      >
        <div className="relative aspect-video overflow-hidden max-sm:h-[30dvh] max-sm:min-h-[160px] max-sm:max-h-[230px] max-sm:aspect-auto">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 via-28% to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 p-4 sm:gap-2 sm:p-5">
            <DialogTitle
              className="text-2xl font-bold tracking-tight text-white sm:text-4xl"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {product.name}
            </DialogTitle>
            <p className="max-w-[85%] text-xs leading-relaxed text-white/70 sm:text-base">
              {product.description}
            </p>
            <p className="text-xl font-bold text-primary sm:text-3xl">
              {formatPrice(product.price)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 z-20 h-8 w-8 rounded-full bg-background/80 text-foreground backdrop-blur-sm hover:bg-background"
            onClick={handleClose}
            aria-label="Cerrar detalles del producto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="product-modal-scroll min-h-0 overflow-y-auto">
          <div className="flex flex-col gap-4 px-4 py-4 pb-6 sm:gap-5 sm:p-5 sm:pr-6">
            {productModifierGroups.map((group) => (
              <div key={group.id}>
                <div className="mb-2 flex items-center justify-between sm:mb-3">
                  <h4 className="font-semibold text-card-foreground text-sm">
                    {group.name}
                  </h4>
                  {group.required && (
                    <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                      Obligatorio
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
                    <div className="flex flex-col gap-1.5 sm:gap-2">
                      {group.options.map((option) => (
                        <Label
                          key={option.id}
                          htmlFor={option.id}
                          className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5 transition-colors hover:bg-secondary sm:rounded-xl sm:px-4 sm:py-3"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value={option.id} id={option.id} />
                            <span className="text-sm text-card-foreground">
                              {option.name}
                            </span>
                          </div>
                          {option.price > 0 && (
                            <span className="text-sm text-muted-foreground">
                              +{formatPrice(option.price)}
                            </span>
                          )}
                        </Label>
                      ))}
                    </div>
                  </RadioGroup>
                ) : (
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    {group.options.map((option) => {
                      const isChecked = selectedModifiers.some(
                        (m) =>
                          m.groupId === group.id && m.optionId === option.id
                      )
                      return (
                        <Label
                          key={option.id}
                          htmlFor={`check-${option.id}`}
                          className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg bg-secondary/50 px-3 py-2.5 transition-colors hover:bg-secondary sm:rounded-xl sm:px-4 sm:py-3"
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
                              +{formatPrice(option.price)}
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

        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-card/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:gap-4 sm:p-5">
          <div className="flex items-center gap-2 rounded-xl bg-secondary px-1 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              aria-label="Disminuir cantidad"
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
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 sm:text-base"
            onClick={handleAddToCart}
          >
            {addButtonLabel} - {formatPrice(itemTotal)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
