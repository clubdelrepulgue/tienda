"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
    Check,
    Clock,
    ChefHat,
    Package,
    Truck,
    ArrowLeft,
    Phone,
    MapPin,
    CreditCard,
    Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import type { Order, OrderStatus } from "@/lib/types"
import { cn, formatPrice } from "@/lib/utils"
import { GoogleMapsProvider, LiveTrackingMap } from "@/components/maps"

interface OrderTrackerProps {
    initialOrder: Order
    token: string
}

const steps: { status: OrderStatus; label: string; icon: any }[] = [
    { status: "new", label: "Recibido", icon: Clock },
    { status: "accepted", label: "Aceptado", icon: Check },
    { status: "preparing", label: "Preparando", icon: ChefHat },
    { status: "en_route", label: "En camino", icon: Truck },
    { status: "delivered", label: "Entregado", icon: Check },
]

const statusIndex: Record<string, number> = {
    new: 0,
    accepted: 1,
    preparing: 2,
    ready: 3,
    en_route: 3,
    delivered: 4,
    cancelled: -1,
}

export function OrderTracker({ initialOrder, token }: OrderTrackerProps) {
    const [order, setOrder] = useState<Order>(initialOrder)
    const [driverId, setDriverId] = useState<string | undefined>(initialOrder.driverId ?? undefined)
    const [branchLocation, setBranchLocation] = useState<{ lat: number; lng: number } | null>(null)

    // Fetch branch coordinates
    useEffect(() => {
        if (!order.branchId) return
        const supabase = createClient()
        supabase
            .from("sucursales")
            .select("lat, lng")
            .eq("id", order.branchId)
            .single()
            .then(({ data }) => {
                if (data?.lat && data?.lng) {
                    setBranchLocation({ lat: parseFloat(data.lat), lng: parseFloat(data.lng) })
                }
            })
    }, [order.branchId])

    useEffect(() => {
        const refreshOrder = async () => {
            const response = await fetch(`/api/order/${encodeURIComponent(token)}`, { cache: "no-store" })
            if (!response.ok) return

            const nextOrder = (await response.json()) as Order
            setOrder(nextOrder)
            setDriverId(nextOrder.driverId ?? undefined)
        }

        const interval = window.setInterval(refreshOrder, 10000)
        return () => {
            window.clearInterval(interval)
        }
    }, [token])

    const currentStepIndex = statusIndex[order.status] ?? 0
    const isCancelled = order.status === "cancelled"

    const hasCoordinates = order.addressLat != null && order.addressLng != null
    const showTracking =
        order.deliveryMethod === "delivery" &&
        driverId &&
        hasCoordinates &&
        order.status === "en_route"

    const destination = hasCoordinates
        ? { lat: order.addressLat!, lng: order.addressLng!, address: order.address }
        : null

    return (
        <GoogleMapsProvider>
            <div className="min-h-screen bg-background">
                <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                    <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3">
                        <Button variant="ghost" size="icon" className="rounded-full" asChild>
                            <Link href="/" aria-label="Volver al menú">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div className="flex-1">
                            <h1
                                className="text-lg font-bold text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                            >
                                Pedido #{order.orderNumber}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Seguí tu pedido en tiempo real
                            </p>
                        </div>
                    </div>
                </header>

                <main className="mx-auto max-w-2xl px-4 py-6 flex flex-col gap-6">
                    {/* Status Stepper */}
                    <Card className="rounded-2xl bg-card border-border">
                        <CardContent className="p-6">
                            {isCancelled ? (
                                <div className="text-center py-4">
                                    <Badge className="bg-destructive/15 text-destructive border-destructive/20 text-sm px-4 py-1.5">
                                        Pedido cancelado
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-3">
                                        Este pedido fue cancelado.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between">
                                    {steps.map((step, i) => {
                                        const isComplete = currentStepIndex >= i
                                        const isCurrent = currentStepIndex === i
                                        const StepIcon = step.icon

                                        return (
                                            <div key={step.status} className="flex items-center flex-1 last:flex-none">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div
                                                        className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center transition-all",
                                                            isComplete
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-secondary text-muted-foreground",
                                                            isCurrent && "ring-4 ring-primary/20"
                                                        )}
                                                    >
                                                        <StepIcon className="h-5 w-5" />
                                                    </div>
                                                    <span
                                                        className={cn(
                                                            "text-xs font-medium text-center",
                                                            isComplete
                                                                ? "text-primary"
                                                                : "text-muted-foreground"
                                                        )}
                                                    >
                                                        {step.label}
                                                    </span>
                                                </div>
                                                {i < steps.length - 1 && (
                                                    <div
                                                        className={cn(
                                                            "flex-1 h-0.5 mx-2 rounded-full transition-colors",
                                                            currentStepIndex > i
                                                                ? "bg-primary"
                                                                : "bg-secondary"
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Live Tracking Map - shows only when driver is specifically heading here */}
                    {showTracking && destination && (
                        <Card className="rounded-2xl bg-card border-border overflow-hidden">
                            <CardContent className="p-4">
                                <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                                    ¡El repartidor viene hacia vos!
                                </h2>
                                <LiveTrackingMap
                                    orderId={order.id}
                                    driverId={driverId}
                                    trackingToken={token}
                                    destination={destination}
                                    branchLocation={branchLocation ?? undefined}
                                    height="300px"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Order Details */}
                    <Card className="rounded-2xl bg-card border-border">
                        <CardContent className="p-5">
                            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                                Detalle del pedido
                            </h2>
                            <div className="flex flex-col gap-3">
                                {order.items.map((item) => {
                                    const modPrice = item.modifiers.reduce(
                                        (sum, m) => sum + m.price,
                                        0
                                    )
                                    return (
                                        <div key={item.id} className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-card-foreground">
                                                    {item.quantity}x {item.name}
                                                    {item.variantName && (
                                                        <span className="text-muted-foreground"> · {item.variantName}</span>
                                                    )}
                                                </p>
                                                {item.modifiers.length > 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.modifiers.map((m) => m.optionName).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-card-foreground">
                                                {formatPrice((item.price + modPrice) * item.quantity)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            <Separator className="my-4" />

                            <div className="flex flex-col gap-2 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>{formatPrice(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Delivery</span>
                                    <span>
                                        {order.deliveryFee > 0
                                            ? formatPrice(order.deliveryFee)
                                            : "Gratis"}
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg text-card-foreground">
                                    <span>Total</span>
                                    <span className="text-primary">{formatPrice(order.total)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer Info */}
                    <Card className="rounded-2xl bg-card border-border">
                        <CardContent className="p-5">
                            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                                Información
                            </h2>
                            <div className="flex flex-col gap-3 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    <span>{order.customerName} · {order.customerPhone}</span>
                                </div>
                                {order.deliveryMethod === "delivery" && order.address && (
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                        <MapPin className="h-4 w-4" />
                                        <span>{order.address}</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    {order.paymentMethod === "mercadopago" ? (
                                        <CreditCard className="h-4 w-4" />
                                    ) : (
                                        <Banknote className="h-4 w-4" />
                                    )}
                                    <span className="capitalize">{order.paymentMethod}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    {order.deliveryMethod === "delivery" ? (
                                        <Truck className="h-4 w-4" />
                                    ) : (
                                        <Package className="h-4 w-4" />
                                    )}
                                    <span className="capitalize">{order.deliveryMethod}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="text-center">
                        <Button asChild variant="outline" className="rounded-xl">
                            <Link href="/">Pedir de nuevo</Link>
                        </Button>
                    </div>
                </main>
            </div>
        </GoogleMapsProvider>
    )
}
