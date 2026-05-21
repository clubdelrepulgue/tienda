"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Plus, Minus, Trash2, ShoppingCart, Receipt, X, CreditCard, Banknote, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createOrder } from "@/app/actions"
import type { Product, Category, Branch } from "@/lib/types"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface CartItem {
    tempId: string
    productId: string
    name: string
    image: string
    price: number
    quantity: number
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [activeCategory, setActiveCategory] = useState<string>("all")
    const [cart, setCart] = useState<CartItem[]>([])
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Checkout form
    const [customerName, setCustomerName] = useState("")
    const [orderType, setOrderType] = useState<"pickup" | "delivery">("pickup")
    const [paymentMethod, setPaymentMethod] = useState<"cash" | "mercadopago">("cash")
    const [selectedBranch, setSelectedBranch] = useState("")

    useEffect(() => {
        Promise.all([
            fetch("/api/admin?type=products").then((r) => r.json()),
            fetch("/api/admin?type=categories").then((r) => r.json()),
            fetch("/api/admin?type=branches").then((r) => r.json()),
        ])
            .then(([productsData, categoriesData, branchesData]) => {
                setProducts(productsData || [])
                setCategories(categoriesData || [])
                setBranches(branchesData || [])
                const openBranch = branchesData?.find((b: Branch) => b.isOpen)
                if (openBranch) setSelectedBranch(openBranch.id)
            })
            .catch(() => toast.error("Error loading data"))
    }, [])

    const filteredProducts = useMemo(() => {
        if (activeCategory === "all") return products.filter((p) => p.active)
        return products.filter((p) => p.categoryId === activeCategory && p.active)
    }, [products, activeCategory])

    const addToCart = (product: Product) => {
        const existingItem = cart.find((item) => item.productId === product.id)

        if (existingItem) {
            setCart(cart.map((item) =>
                item.tempId === existingItem.tempId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ))
        } else {
            const newItem: CartItem = {
                tempId: `${product.id}-${Date.now()}`,
                productId: product.id,
                name: product.name,
                image: product.image,
                price: product.price,
                quantity: 1,
            }
            setCart([...cart, newItem])
        }
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
    }

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

    const handleCheckout = async () => {
        if (cart.length === 0) {
            toast.error("Cart is empty")
            return
        }
        if (!customerName) {
            toast.error("Enter customer name")
            return
        }
        if (!selectedBranch) {
            toast.error("Select a branch")
            return
        }

        setLoading(true)
        try {
            const result = await createOrder({
                customerName,
                customerPhone: "POS",
                fulfillmentType: orderType,
                addressText: "",
                notes: "Pedido desde mostrador",
                paymentMethod,
                sucursalId: selectedBranch,
                items: cart.map((item) => ({
                    id: item.tempId,
                    productId: item.productId,
                    name: item.name,
                    image: item.image,
                    price: item.price,
                    quantity: item.quantity,
                    modifiers: [],
                })),
                subtotal,
                deliveryFee: 0,
                total: subtotal,
                orderType: "pos",
            })

            if ("error" in result) {
                toast.error(result.error)
                return
            }

            toast.success(`Order #${result.orderNumber} created!`)
            clearCart()
            setIsCheckoutOpen(false)
        } catch {
            toast.error("Error creating order")
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
                                All
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
                                onClick={() => addToCart(product)}
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
                                            ${product.price.toFixed(2)}
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
                                Current Order
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
                                Clear
                            </Button>
                        )}
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                            <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
                            <p className="text-sm">Tap products to add</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map((item) => (
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
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            ${item.price.toFixed(2)}
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
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t border-border space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center text-lg font-bold">
                        <span>Total</span>
                        <span className="text-primary">${subtotal.toFixed(2)}</span>
                    </div>
                    <Button
                        className="w-full h-14 rounded-xl text-lg font-semibold"
                        disabled={cart.length === 0}
                        onClick={() => setIsCheckoutOpen(true)}
                    >
                        <Receipt className="h-5 w-5 mr-2" />
                        Charge
                    </Button>
                </div>
            </div>

            {/* Checkout Dialog */}
            <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Complete Order</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div>
                            <Label>Customer Name</Label>
                            <Input
                                placeholder="Enter name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="rounded-xl mt-1.5"
                            />
                        </div>

                        <div>
                            <Label>Branch</Label>
                            <select
                                value={selectedBranch}
                                onChange={(e) => setSelectedBranch(e.target.value)}
                                className="w-full mt-1.5 rounded-xl border border-input bg-background px-3 py-2 text-sm"
                            >
                                <option value="">Select branch</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>Order Type</Label>
                            <RadioGroup
                                value={orderType}
                                onValueChange={(v) => setOrderType(v as "pickup" | "delivery")}
                                className="flex gap-4 mt-1.5"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="pickup" id="pickup" />
                                    <Label htmlFor="pickup" className="cursor-pointer">Pickup</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="delivery" id="delivery" />
                                    <Label htmlFor="delivery" className="cursor-pointer">Delivery</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        <div>
                            <Label>Payment Method</Label>
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
                                    <span className="text-sm font-medium">Cash</span>
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
                                    <span className="text-sm font-medium">Card</span>
                                </button>
                            </div>
                        </div>

                        <Separator />

                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Total</span>
                            <span className="text-primary">${subtotal.toFixed(2)}</span>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1 rounded-xl h-12"
                                onClick={() => setIsCheckoutOpen(false)}
                            >
                                Cancel
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
                                Complete
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
