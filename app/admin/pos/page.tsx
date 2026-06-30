"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Plus, Minus, Trash2, ShoppingCart, Receipt, X, CreditCard, Banknote, Loader2, MapPin, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ProductModal } from "@/components/storefront/product-modal"
import { createOrder } from "@/app/actions"
import type { Product, Category, Branch, CartItemModifier, ModifierGroup, CartItem as OrderCartItem, DeliveryZone, Order } from "@/lib/types"
import { printOrderReceipt } from "@/components/receipt/order-receipt"
import { toast } from "sonner"
import { cn, formatPrice } from "@/lib/utils"
import { playNewOrderSound, unlockAudio } from "@/lib/sounds"
import { GoogleMapsProvider, AddressSelector } from "@/components/maps"
import { findDeliveryZoneForPoint, formatZoneMeta, getZoneDeliveryFee } from "@/lib/delivery-zones"
import { useActiveBranch } from "../branch-context"

interface PosCartItem {
    tempId: string
    productId: string
    name: string
    image: string
    price: number
    quantity: number
    modifiers: CartItemModifier[]
    variantId?: string
    variantName?: string
    note?: string
}

export default function POSPage() {
    const { activeBranchId, branches } = useActiveBranch()
    const selectedBranch = activeBranchId ?? ""
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([])
    const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
    const [activeCategory, setActiveCategory] = useState<string>("all")
    const [cart, setCart] = useState<PosCartItem[]>([])
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [productModalOpen, setProductModalOpen] = useState(false)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Checkout form
    const [customerName, setCustomerName] = useState("")
    const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup")
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "mercadopago">("cash")
    const [deliveryAddress, setDeliveryAddress] = useState("")
    const [deliveryNotes, setDeliveryNotes] = useState("")
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null)
    const [selectedZone, setSelectedZone] = useState("")

    useEffect(() => {
        unlockAudio()
    }, [])

    useEffect(() => {
        if (!selectedBranch) return

        Promise.all([
            fetch(`/api/admin?type=products&branchId=${selectedBranch}`).then((r) => r.json()),
            fetch(`/api/admin?type=categories&branchId=${selectedBranch}`).then((r) => r.json()),
            fetch(`/api/admin?type=modifiers&branchId=${selectedBranch}`).then((r) => r.json()),
            fetch(`/api/admin?type=delivery-zones&branchId=${selectedBranch}`).then((r) => r.json()),
        ])
            .then(([productsData, categoriesData, modifiersData, zonesData]) => {
                setProducts(productsData || [])
                setCategories(categoriesData || [])
                setModifierGroups(modifiersData || [])
                setDeliveryZones((zonesData || []).filter((zone: DeliveryZone) => zone.isActive))
                setActiveCategory("all")
                setCart([])
                setDeliveryAddress("")
                setDeliveryNotes("")
                setSelectedLocation(null)
                setSelectedZone("")
            })
            .catch(() => toast.error("Error al cargar menu de la sucursal"))
    }, [selectedBranch])

    const filteredProducts = useMemo(() => {
        if (activeCategory === "all") return products.filter((p) => p.active)
        return products.filter((p) => p.categoryId === activeCategory && p.active)
    }, [products, activeCategory])

    const getModifiersKey = (modifiers: CartItemModifier[]) =>
        modifiers
            .map((modifier) => `${modifier.groupId}:${modifier.optionId}`)
            .sort()
            .join("|")

    const productHasAvailableModifiers = (product: Product) =>
        modifierGroups.some(
            (group) =>
                product.modifierGroups.includes(group.id) &&
                group.options.length > 0
        )

    const productHasVariants = (product: Product) =>
        (product.variants || []).some((v) => v.active)

    const addToCart = (
        product: Product,
        modifiers: CartItemModifier[] = [],
        quantity = 1,
        opts?: { price?: number; variantId?: string; variantName?: string; note?: string }
    ) => {
        const modifiersKey = getModifiersKey(modifiers)
        const variantId = opts?.variantId || ""
        const note = (opts?.note || "").trim()
        const existingItem = cart.find(
            (item) =>
                item.productId === product.id &&
                (item.variantId || "") === variantId &&
                (item.note || "").trim() === note &&
                getModifiersKey(item.modifiers) === modifiersKey
        )

        if (existingItem) {
            setCart(cart.map((item) =>
                item.tempId === existingItem.tempId
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            ))
        } else {
            const newItem: PosCartItem = {
                tempId: `${product.id}-${Date.now()}`,
                productId: product.id,
                name: product.name,
                image: product.image,
                price: opts?.price ?? product.price,
                quantity,
                modifiers,
                variantId: opts?.variantId,
                variantName: opts?.variantName,
                note: opts?.note?.trim() || undefined,
            }
            setCart([...cart, newItem])
        }
    }

    const handleProductClick = (product: Product) => {
        if (productHasVariants(product) || productHasAvailableModifiers(product)) {
            setSelectedProduct(product)
            setProductModalOpen(true)
            return
        }

        addToCart(product)
    }

    const handleAddConfiguredProduct = (item: Omit<OrderCartItem, "id">) => {
        const product = products.find((p) => p.id === item.productId)
        if (!product) return

        addToCart(product, item.modifiers, item.quantity, {
            price: item.price,
            variantId: item.variantId,
            variantName: item.variantName,
            note: item.note,
        })
    }

    const updateQuantity = (tempId: string, delta: number) => {
        setCart(cart.map((item) => {
            if (item.tempId === tempId) {
                const newQty = item.quantity + delta
                return newQty > 0 ? { ...item, quantity: newQty } : item
            }
            return item
        }).filter((item) => item.quantity > 0))
    }

    const removeFromCart = (tempId: string) => {
        setCart(cart.filter((item) => item.tempId !== tempId))
    }

    const clearCart = () => {
        setCart([])
        setCustomerName("")
        setDeliveryAddress("")
        setDeliveryNotes("")
        setSelectedLocation(null)
        setSelectedZone("")
    }

    const subtotal = cart.reduce((sum, item) => {
        const modifiersPrice = item.modifiers.reduce((modSum, modifier) => modSum + modifier.price, 0)
        return sum + (item.price + modifiersPrice) * item.quantity
    }, 0)

    const selectedBranchInfo = branches.find((branch) => branch.id === selectedBranch)
    const selectedBranchLocation =
        selectedBranchInfo?.lat != null && selectedBranchInfo?.lng != null
            ? {
                lat: selectedBranchInfo.lat,
                lng: selectedBranchInfo.lng,
                title: selectedBranchInfo.name,
            }
            : undefined
    const visibleDeliveryZones = useMemo(
        () => deliveryZones.filter((zone) => zone.isActive),
        [deliveryZones]
    )
    const selectedZoneInfo = visibleDeliveryZones.find((zone) => zone.id === selectedZone)
    const hasCoverageCheck = orderType === "delivery" && visibleDeliveryZones.length > 0
    const isOutsideCoverage = hasCoverageCheck && selectedLocation && !selectedZoneInfo
    const shouldCalculateDelivery = hasCoverageCheck && !selectedZoneInfo
    const deliveryFee = orderType === "delivery"
        ? getZoneDeliveryFee(selectedZoneInfo, subtotal)
        : 0
    const orderTotal = subtotal + deliveryFee

    useEffect(() => {
        if (orderType !== "delivery") {
            setDeliveryAddress("")
            setDeliveryNotes("")
            setSelectedLocation(null)
            setSelectedZone("")
        }
    }, [orderType])

    useEffect(() => {
        if (!selectedLocation) {
            setSelectedZone("")
            return
        }

        setDeliveryAddress(selectedLocation.address)
        const zone = findDeliveryZoneForPoint(visibleDeliveryZones, selectedLocation)
        setSelectedZone(zone?.id || "")

        if (!zone && visibleDeliveryZones.length > 0 && orderType === "delivery") {
            toast.warning("Esa dirección está fuera de las zonas de envío de esta sucursal")
        }
    }, [orderType, selectedLocation, visibleDeliveryZones])

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error("El carrito esta vacio")
            return
        }
        if (!customerName) {
            toast.error("Ingresa el nombre del cliente")
            return
        }
        if (!selectedBranch) {
            toast.error("Selecciona una sucursal")
            return
        }
        if (orderType === "delivery" && !deliveryAddress.trim()) {
            toast.error("Ingresa la dirección de entrega")
            return
        }
        if (orderType === "delivery" && !selectedLocation) {
            toast.error("Marca la ubicación en el mapa para calcular la zona de envío")
            return
        }
        if (orderType === "delivery" && visibleDeliveryZones.length > 0 && !selectedZone) {
            toast.error("La ubicación está fuera de las zonas de envío disponibles")
            return
        }

        setLoading(true)
        try {
            const result = await createOrder({
                customerName,
                customerPhone: "POS",
                fulfillmentType: orderType,
                addressText: orderType === "delivery" ? deliveryAddress : "",
                notes: orderType === "delivery" && deliveryNotes
                    ? `Pedido desde mostrador\n${deliveryNotes}`
                    : "Pedido desde mostrador",
                paymentMethod,
                sucursalId: selectedBranch,
                items: cart.map((item) => ({
                    id: item.tempId,
                    productId: item.productId,
                    branchId: selectedBranch,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    quantity: item.quantity,
                    modifiers: item.modifiers,
                    variantId: item.variantId,
                    variantName: item.variantName,
                    note: item.note,
                })),
                subtotal,
                deliveryFee,
                total: orderTotal,
                deliveryZoneId: orderType === "delivery" ? selectedZone || undefined : undefined,
                orderType: "pos",
                addressLat: orderType === "delivery" ? selectedLocation?.lat : undefined,
                addressLng: orderType === "delivery" ? selectedLocation?.lng : undefined,
            })

            if ("error" in result) {
                toast.error(result.error)
                return
            }

            playNewOrderSound()
            toast.success(`Pedido #${result.orderNumber} creado`)

            // Build the order locally and print 2 copies with branch data.
            const printableOrder: Order = {
                id: result.orderId,
                orderNumber: result.orderNumber,
                customerName,
                customerPhone: "",
                address: orderType === "delivery" ? deliveryAddress : "",
                deliveryNotes: orderType === "delivery" ? deliveryNotes : "",
                deliveryMethod: orderType,
                paymentMethod,
                items: cart.map((item) => ({
                    id: item.tempId,
                    productId: item.productId,
                    branchId: selectedBranch,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    quantity: item.quantity,
                    modifiers: item.modifiers,
                    variantId: item.variantId,
                    variantName: item.variantName,
                    note: item.note,
                })),
                subtotal,
                deliveryFee,
                total: orderTotal,
                status: "new",
                createdAt: new Date().toISOString(),
                branchId: selectedBranch,
            }
            printOrderReceipt(printableOrder, selectedBranchInfo)

            clearCart()
            setIsCheckoutOpen(false)
        } catch {
            toast.error("Error al crear el pedido")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex gap-4">
            {/* Left Side - Products */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Categories */}
                <div className="mb-4">
                    <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                        <TabsList className="bg-secondary/50 p-1 flex flex-wrap h-auto">
                            <TabsTrigger value="all" className="rounded-lg">
                                Todos
                            </TabsTrigger>
                            {categories.map((cat) => (
                                <TabsTrigger key={cat.id} value={cat.id} className="rounded-lg">
                                    {cat.name}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </div>

                {/* Products Grid */}
                <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {filteredProducts.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => handleProductClick(product)}
                                className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 transition-colors text-left"
                            >
                                <div className="relative aspect-square">
                                    <Image
                                        src={product.image}
                                        alt={product.name}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform"
                                        sizes="200px"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                    <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="font-medium text-white text-sm line-clamp-2">
                                            {product.name}
                                        </p>
                                        <p className="text-white/90 text-sm font-bold">
                                            {formatPrice(product.price)}
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute top-2 right-2">
                                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Plus className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Side - Cart */}
            <div className="w-80 lg:w-96 flex flex-col bg-card border border-border rounded-2xl">
                <div className="p-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                            <h2
                                className="font-bold text-lg text-card-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                            >
                                Pedido actual
                            </h2>
                        </div>
                        {cart.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={clearCart}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Limpiar
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
                            <p className="text-sm">Toca productos para agregarlos</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map((item) => {
                                const modifiersPrice = item.modifiers.reduce(
                                    (sum, modifier) => sum + modifier.price,
                                    0
                                )
                                const unitPrice = item.price + modifiersPrice

                                return (
                                    <div
                                        key={item.tempId}
                                        className="flex items-center gap-3 p-2 rounded-xl bg-secondary/50"
                                    >
                                        <div className="relative h-12 w-12 rounded-lg overflow-hidden shrink-0">
                                            <Image
                                                src={item.image}
                                                alt={item.name}
                                                fill
                                                className="object-cover"
                                                sizes="48px"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-card-foreground truncate">
                                                {item.name}
                                                {item.variantName && (
                                                    <span className="text-muted-foreground"> · {item.variantName}</span>
                                                )}
                                            </p>
                                            {item.modifiers.length > 0 && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {item.modifiers.map((modifier) => modifier.optionName).join(", ")}
                                                </p>
                                            )}
                                            {item.note && (
                                                <p className="text-xs italic text-muted-foreground/90 truncate">
                                                    “{item.note}”
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                {formatPrice(unitPrice)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-full"
                                                onClick={() => updateQuantity(item.tempId, -1)}
                                            >
                                                <Minus className="h-3 w-3" />
                                            </Button>
                                            <span className="w-6 text-center font-medium text-sm">
                                                {item.quantity}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-full"
                                                onClick={() => updateQuantity(item.tempId, 1)}
                                            >
                                                <Plus className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            onClick={() => removeFromCart(item.tempId)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-border space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">{formatPrice(subtotal)}</span>
                    </div>
                    {deliveryFee > 0 && (
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Envío</span>
                            <span className="font-medium">{formatPrice(deliveryFee)}</span>
                        </div>
                    )}
                    <Separator />
                    <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">{formatPrice(orderTotal)}</span>
                    </div>
                    <Button
                        className="w-full h-14 rounded-xl text-lg font-semibold"
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                    >
                        <Receipt className="h-5 w-5 mr-2" />
                        Cobrar
                    </Button>
                </div>
            </div>

            {/* Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Completar pedido</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Nombre del cliente</Label>
                            <Input
                                placeholder="Ingresa el nombre"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="rounded-xl mt-1.5"
                            />
                        </div>

                        <div>
                            <Label>Sucursal</Label>
                            <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                                {selectedBranchInfo?.name || "Sin sucursal seleccionada"}
                            </div>
                        </div>

                        <div>
                            <Label>Tipo de pedido</Label>
                            <RadioGroup
                                value={orderType}
                                onValueChange={(v) => setOrderType(v as "pickup" | "delivery")}
                                className="flex gap-4 mt-1.5"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="pickup" id="pickup" />
                                    <Label htmlFor="pickup" className="cursor-pointer">Retiro</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="delivery" id="delivery" />
                                    <Label htmlFor="delivery" className="cursor-pointer">Delivery</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {orderType === "delivery" && (
                            <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    <Label className="font-semibold">Ubicación de entrega</Label>
                                </div>
                                <GoogleMapsProvider>
                                    <AddressSelector
                                        value={selectedLocation || undefined}
                                        onChange={setSelectedLocation}
                                        onAddressChange={setDeliveryAddress}
                                        defaultCenter={selectedBranchLocation}
                                        searchCenter={selectedBranchLocation}
                                        searchRadiusKm={80}
                                        branchMarker={selectedBranchLocation}
                                        zones={visibleDeliveryZones.map((zone) => ({
                                            id: zone.id,
                                            name: zone.name,
                                            color: zone.color,
                                            coordinates: zone.coordinates || [],
                                        }))}
                                        height="240px"
                                        placeholder="Buscar dirección de entrega..."
                                        showInstructions={false}
                                        simpleMap
                                        lazyMap
                                    />
                                </GoogleMapsProvider>

                                <div className="rounded-xl border border-border bg-background p-3">
                                    {selectedZoneInfo ? (
                                        <div className="flex items-start gap-3">
                                            <span
                                                className="mt-1 h-3 w-3 rounded-full shrink-0"
                                                style={{ backgroundColor: selectedZoneInfo.color }}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground">
                                                    {selectedZoneInfo.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatZoneMeta(selectedZoneInfo)}
                                                </p>
                                            </div>
                                        </div>
                                    ) : isOutsideCoverage ? (
                                        <p className="text-sm text-destructive">
                                            Esta ubicación está fuera de las zonas de envío.
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Buscá la dirección o mové el pin para calcular el envío.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <Label className="text-sm text-muted-foreground mb-1.5 block">
                                        Notas de entrega
                                    </Label>
                                    <Textarea
                                        placeholder="Tocar timbre, referencia, apartamento, etc."
                                        value={deliveryNotes}
                                        onChange={(e) => setDeliveryNotes(e.target.value)}
                                        rows={2}
                                        className="rounded-xl bg-background resize-none"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <Label>Metodo de pago</Label>
                            <div className="grid grid-cols-2 gap-3 mt-1.5">
                                <button
                                    onClick={() => setPaymentMethod("cash")}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                                        paymentMethod === "cash"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-muted-foreground/30"
                                    )}
                                >
                                    <Banknote className="h-6 w-6" />
                                    <span className="text-sm font-medium">Efectivo</span>
                                </button>
                                <button
                                    onClick={() => setPaymentMethod("mercadopago")}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors",
                                        paymentMethod === "mercadopago"
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-muted-foreground/30"
                                    )}
                                >
                                    <CreditCard className="h-6 w-6" />
                                    <span className="text-sm font-medium">Tarjeta</span>
                                </button>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Subtotal</span>
                                <span>{formatPrice(subtotal)}</span>
                            </div>
                            {orderType === "delivery" && (
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Truck className="h-3.5 w-3.5" />
                                        {selectedZoneInfo ? `Envío · ${selectedZoneInfo.name}` : "Envío"}
                                    </span>
                                    <span>
                                        {shouldCalculateDelivery
                                            ? "A calcular"
                                            : deliveryFee > 0
                                                ? formatPrice(deliveryFee)
                                                : "Gratis"}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between items-center text-xl font-bold">
                                <span>Total</span>
                                <span className="text-primary">{formatPrice(orderTotal)}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12"
                                onClick={() => setIsCheckoutOpen(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 rounded-xl h-12"
                                onClick={handleCheckout}
                                disabled={loading || !customerName || !selectedBranch}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Receipt className="h-4 w-4 mr-2" />
                                )}
                                Completar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ProductModal
                product={selectedProduct}
                branch={branches.find((branch) => branch.id === selectedBranch) || {
                    id: selectedBranch,
                    slug: selectedBranch,
                    name: "Sucursal",
                    address: "",
                    logoUrl: "",
                    bannerUrl: "",
                    brandColor: "#E86303",
                    accentColor: "#F97316",
                    heroTitle: "",
                    heroSubtitle: "",
                    lat: null,
                    lng: null,
                    isOpen: true,
                }}
                allModifierGroups={modifierGroups}
                open={productModalOpen}
                onAddItem={handleAddConfiguredProduct}
                addButtonLabel="Agregar al pedido"
                successMessage={(product) => `${product.name} agregado al pedido`}
                onClose={() => {
                    setProductModalOpen(false)
                    setSelectedProduct(null)
                }}
            />
        </div>
    )
}
