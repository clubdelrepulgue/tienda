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
import { cn } from "@/lib/utils"
import { GoogleMapsProvider, LiveTrackingMap } from "@/components/maps"

interface OrderTrackerProps {
    initialOrder: Order
    token: string
}

const steps: { status: OrderStatus; label: string; icon: any }[] = [
    { status: "new", label: "Order Placed", icon: Clock },
    { status: "accepted", label: "Accepted", icon: Check },
    { status: "preparing", label: "Preparing", icon: ChefHat },
    { status: "ready", label: "Ready", icon: Package },
    { status: "delivered", label: "Delivered", icon: Truck },
]

const statusIndex: Record<string, number> = {
    new: 0,
    accepted: 1,
    preparing: 2,
    ready: 3,
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
        const supabase = createClient()

        const channel = supabase
            .channel(`order-${token}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "orders",
                    filter: `public_tracking_token=eq.${token}`,
                },
                (payload) => {
                    const row = payload.new as any
                    setOrder((prev) => ({
                        ...prev,
                        status: row.status,
                        acceptedAt: row.accepted_at || prev.acceptedAt,
                        preparingAt: row.preparing_at || prev.preparingAt,
                        readyAt: row.ready_at || prev.readyAt,
                        deliveredAt: row.delivered_at || prev.deliveredAt,
                        cancelledAt: row.cancelled_at || prev.cancelledAt,
                        driverId: row.driver_id || prev.driverId,
                        addressLat: row.address_lat ? parseFloat(row.address_lat) : prev.addressLat,
                        addressLng: row.address_lng ? parseFloat(row.address_lng) : prev.addressLng,
                    }))
                    if (row.driver_id) {
                        setDriverId(row.driver_id)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [token])

    const currentStepIndex = statusIndex[order.status] ?? 0
    const isCancelled = order.status === "cancelled"

    // Show tracking when driver assigned AND order is being delivered (ready status = driver en camino)
    const hasCoordinates = order.addressLat != null && order.addressLng != null
    const showTracking =
        order.deliveryMethod === "delivery" &&
        driverId &&
        hasCoordinates &&
        order.status === "ready"

    const destination = hasCoordinates
        ? { lat: order.addressLat!, lng: order.addressLng!, address: order.address }
        : null

    return (
        <GoogleMapsProvider>
            <div className="min-h-screen bg-background">
                <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                    <div className="mx-auto max-w-2xl flex items-center gap-3 px-4 py-3">
                        <Button variant="ghost" size="icon" className="rounded-full" asChild>
                            <Link href="/" aria-label="Back to menu">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div className="flex-1">
                            <h1
                                className="text-lg font-bold text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                            >
                                Order #{order.orderNumber}
                            </h1>
                            <p className="text-xs text-muted-foreground">
                                Track your order in real time
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
                                        Order Cancelled
                                    </Badge>
                                    <p className="text-sm text-muted-foreground mt-3">
                                        This order has been cancelled.
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

                    {/* Live Tracking Map - Show when driver assigned and has coordinates */}
                    {showTracking && destination && (
                        <Card className="rounded-2xl bg-card border-border overflow-hidden">
                            <CardContent className="p-4">
                                <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                                    Tu repartidor está en camino
                                </h2>
                                <LiveTrackingMap
                                    orderId={order.id}
                                    driverId={driverId}
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
                                Order Details
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
                                                </p>
                                                {item.modifiers.length > 0 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.modifiers.map((m) => m.optionName).join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                            <span className="text-sm font-medium text-card-foreground">
                                                ${((item.price + modPrice) * item.quantity).toFixed(2)}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>

                            <Separator className="my-4" />

                            <div className="flex flex-col gap-2 text-sm">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>${order.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Delivery</span>
                                    <span>
                                        {order.deliveryFee > 0
                                            ? `$${order.deliveryFee.toFixed(2)}`
                                            : "Free"}
                                    </span>
                                </div>
                                <Separator />
                                <div className="flex justify-between font-bold text-lg text-card-foreground">
                                    <span>Total</span>
                                    <span className="text-primary">${order.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Customer Info */}
                    <Card className="rounded-2xl bg-card border-border">
                        <CardContent className="p-5">
                            <h2 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide">
                                Info
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
                            <Link href="/">Order Again</Link>
                        </Button>
                    </div>
                </main>
            </div>
        </GoogleMapsProvider>
    )
}
