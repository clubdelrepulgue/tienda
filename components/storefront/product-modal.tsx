"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent,
  type WheelEvent,
} from "react"
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
import { formatPrice } from "@/lib/utils"
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
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const pointerStartYRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
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
    setHeaderCollapsed(false)
    scrollContainerRef.current?.scrollTo({ top: 0 })
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
    setHeaderCollapsed(false)
    onClose()
  }

  const handleClose = () => {
    setQuantity(1)
    setSelectedModifiers([])
    setSelectedVariantId(activeVariants[0]?.id || "")
    setNote("")
    setHeaderCollapsed(false)
    onClose()
  }

  // ── Collapsible header on scroll (mobile only) ──────────────────────────
  const isMobileViewport = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches

  const handleScrollIntent = (deltaY: number) => {
    if (!isMobileViewport() || Math.abs(deltaY) < 4) return

    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0

    if (deltaY > 0) {
      setHeaderCollapsed(true)
    } else if (scrollTop <= 0) {
      setHeaderCollapsed(false)
    }
  }

  const handleContentScroll = () => {
    if (!isMobileViewport()) {
      setHeaderCollapsed(false)
      return
    }

    if ((scrollContainerRef.current?.scrollTop ?? 0) > 12) {
      setHeaderCollapsed(true)
    }
  }

  const handleModalWheel = (event: WheelEvent<HTMLDivElement>) => {
    handleScrollIntent(event.deltaY)
  }

  const handleModalPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return
    pointerStartYRef.current = event.clientY
  }

  const handleModalPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const startY = pointerStartYRef.current
    if (startY === null || event.pointerType === "mouse") return
    handleScrollIntent(startY - event.clientY)
  }

  const handleModalTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null
  }

  const handleModalTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current
    const currentY = event.touches[0]?.clientY
    if (startY === null || currentY === undefined) return
    handleScrollIntent(startY - currentY)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        onWheel={handleModalWheel}
        onPointerDown={handleModalPointerDown}
        onPointerMove={handleModalPointerMove}
        onTouchStart={handleModalTouchStart}
        onTouchMove={handleModalTouchMove}
        className="grid gap-0 overflow-hidden border-border bg-white p-0 max-sm:fixed max-sm:inset-0 max-sm:!top-0 max-sm:!left-0 max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0 max-sm:grid-rows-[auto_minmax(0,1fr)_auto] max-sm:rounded-none max-sm:border-0 sm:max-h-[90vh] sm:max-w-lg sm:grid-rows-[auto_minmax(0,1fr)_auto] sm:rounded-2xl"
      >
        {/* ── Mobile header: big → collapses to compact bar on scroll ── */}
        <div
          className="overflow-hidden sm:hidden"
          onWheel={handleModalWheel}
          onPointerDown={handleModalPointerDown}
          onPointerMove={handleModalPointerMove}
          onTouchStart={handleModalTouchStart}
          onTouchMove={handleModalTouchMove}
        >
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              headerCollapsed
                ? "max-h-0 -translate-y-2 opacity-0"
                : "max-h-[calc(100vw+160px)] translate-y-0 opacity-100"
            }`}
          >
            <div className="relative mx-auto mt-[10px] aspect-square w-[min(calc(100vw-20px),calc(100dvh-260px))] overflow-hidden rounded-xl bg-secondary">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover object-center"
                sizes="100vw"
              />
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full border border-white/15 bg-black/45 text-white shadow-lg shadow-black/25 backdrop-blur-md hover:bg-black/60 hover:text-white"
                onClick={handleClose}
                aria-label="Cerrar detalles del producto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-1 border-b border-border bg-white px-4 py-3">
              <DialogTitle
                className="line-clamp-2 text-[25px] font-extrabold leading-[1.08] tracking-normal text-foreground"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {product.name}
              </DialogTitle>
              <p className="text-lg font-extrabold leading-tight text-primary">
                {formatPrice(basePrice)}
              </p>
              {product.description && (
                <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  {product.description}
                </p>
              )}
            </div>
          </div>

          <div
            className={`relative overflow-hidden border-b border-border bg-white/95 backdrop-blur-xl transition-all duration-300 ease-out ${
              headerCollapsed
                ? "max-h-24 translate-y-0 opacity-100"
                : "max-h-0 -translate-y-3 opacity-0"
            }`}
          >
            <div className="flex min-h-[76px] items-center gap-3 px-3 py-2.5 pr-12">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary shadow-md shadow-black/25">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover object-center"
                  sizes="56px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  className="line-clamp-1 text-base font-extrabold leading-tight text-foreground"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {product.name}
                </h3>
                {product.description && (
                  <p className="line-clamp-1 text-xs leading-snug text-muted-foreground">
                    {product.description}
                  </p>
                )}
                <p className="mt-0.5 text-sm font-bold leading-none text-primary">
                  {formatPrice(basePrice)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-3 z-20 h-8 w-8 rounded-full border border-border bg-black/35 text-white backdrop-blur-md hover:bg-black/55 hover:text-white"
                onClick={handleClose}
                aria-label="Cerrar detalles del producto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── Desktop header: static ── */}
        <div className="hidden overflow-hidden sm:block">
          <div className="relative h-[220px] overflow-hidden">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-cover object-center"
              sizes="512px"
            />
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/35 to-transparent" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-20 h-9 w-9 rounded-full border border-white/15 bg-black/45 text-white shadow-lg shadow-black/25 backdrop-blur-md hover:bg-black/60 hover:text-white"
              onClick={handleClose}
              aria-label="Cerrar detalles del producto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-1 border-b border-border bg-white px-5 py-4">
            <DialogTitle
              className="line-clamp-2 text-[28px] font-extrabold leading-[1.08] tracking-normal text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {product.name}
            </DialogTitle>
            <p className="text-lg font-extrabold leading-tight text-primary">
              {formatPrice(basePrice)}
            </p>
            {product.description && (
              <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* ── Scrollable body: variants + modifiers + note ── */}
        <div
          ref={scrollContainerRef}
          onScroll={handleContentScroll}
          className="product-modal-scroll min-h-0 overflow-y-auto bg-white"
        >
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
                          {formatPrice(variant.price)}
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
                              +{formatPrice(option.price)}
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

        {/* ── Add to cart footer ── */}
        <div className="sticky bottom-0 flex items-center gap-4 border-t border-border bg-secondary/50 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5">
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
            {addButtonLabel} — {formatPrice(itemTotal)}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
