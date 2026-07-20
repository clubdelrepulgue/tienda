"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    Package, MapPin, Phone, LogOut, Clock, Navigation,
    Locate, AlertCircle, Wifi, Truck, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { completeDriverOrder, setOrderEnRoute } from "@/app/actions"
import type { DeliveryZone, Order } from "@/lib/types"
import { toast } from "sonner"
import { useDriverLocation } from "@/hooks/use-driver-location"
import { GoogleMapsProvider, LiveTrackingMap } from "@/components/maps"
import { formatZoneMeta } from "@/lib/delivery-zones"
import { formatPrice } from "@/lib/utils"
import { unlockAudio, playChime } from "@/lib/notification-sound"

export default function DriverDashboardPage() {
    const [driverId, setDriverId] = useState<string | null>(null)
    const [driverName, setDriverName] = useState<string>("")
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [storageError, setStorageError] = useState(false)
    const [branchLocations, setBranchLocations] = useState<Record<string, { lat: number; lng: number }>>({})
    const [deliveryZones, setDeliveryZones] = useState<Record<string, DeliveryZone>>({})
    const [enRoutingId, setEnRoutingId] = useState<string | null>(null)
    const [deliveringId, setDeliveringId] = useState<string | null>(null)
    const [navFocus, setNavFocus] = useState(0)
    const mapSectionRef = useRef<HTMLDivElement>(null)
    const knownOrderIdsRef = useRef<Set<string> | null>(null)
    const router = useRouter()

    const { lastLocation, error, locationStatus } = useDriverLocation({
        driverId,
        enabled: true,
        interval: 10000,
        onError: (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                toast.error("Por favor habilita la ubicación GPS para continuar")
            }
        },
    })

    useEffect(() => {
        let id = null
        let name = null
        try {
            id = localStorage.getItem("driverId")
            name = localStorage.getItem("driverName")
        } catch {}

        if (!id) {
            try {
                id = sessionStorage.getItem("driverId")
                name = sessionStorage.getItem("driverName")
                if (id) setStorageError(true)
            } catch {}
        }

        if (!id) { router.push("/driver"); return }

        setDriverId(id)
        setDriverName(name || "")
        loadOrders(id)
    }, [router])

    useEffect(() => {
        if (!driverId) return
        const supabase = createClient()
        const channel = supabase
            .channel("driver-orders")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders", filter: `driver_id=eq.${driverId}` },
                () => loadOrders(driverId)
            )
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [driverId])

    // Mobile browsers only allow audio to start from within a user gesture,
    // so we "unlock" the AudioContext on the first tap and reuse it later
    // when a new order arrives via Realtime (no further gesture needed then).
    useEffect(() => {
        if (!driverId) return
        const unlock = () => unlockAudio()
        document.addEventListener("pointerdown", unlock, { once: true })
        document.addEventListener("touchstart", unlock, { once: true })
        return () => {
            document.removeEventListener("pointerdown", unlock)
            document.removeEventListener("touchstart", unlock)
        }
    }, [driverId])

    const loadOrders = async (id: string) => {
        try {
            const response = await fetch(`/api/driver/orders?driverId=${id}`)
            const data = await response.json()
            const list: Order[] = data || []
            setOrders(list)

            const currentIds = new Set(list.map((o) => o.id))
            if (knownOrderIdsRef.current) {
                const newOrders = list.filter(
                    (o) => o.status === "ready" && !knownOrderIdsRef.current!.has(o.id)
                )
                if (newOrders.length > 0) {
                    playChime()
                    toast.success(
                        newOrders.length === 1
                            ? `¡Nuevo pedido asignado! #${newOrders[0].orderNumber}`
                            : `¡${newOrders.length} nuevos pedidos asignados!`,
                        { duration: 6000 }
                    )
                }
            }
            knownOrderIdsRef.current = currentIds

            const branchIds = [...new Set((data || []).map((o: Order) => o.branchId).filter(Boolean))]
            if (branchIds.length > 0) {
                const supabase = createClient()
                const { data: branches } = await supabase
                    .from("sucursales").select("id, lat, lng").in("id", branchIds)
                if (branches) {
                    const locs: Record<string, { lat: number; lng: number }> = {}
                    for (const b of branches) {
                        if (b.lat && b.lng) locs[b.id] = { lat: parseFloat(b.lat), lng: parseFloat(b.lng) }
                    }
                    setBranchLocations(locs)
                }
            }

            const zoneIds = [...new Set((data || []).map((o: Order) => o.deliveryZoneId).filter(Boolean))]
            if (zoneIds.length > 0) {
                const supabase = createClient()
                const { data: zones } = await supabase
                    .from("delivery_zones").select("*").in("id", zoneIds)
                if (zones) {
                    const mapped: Record<string, DeliveryZone> = {}
                    for (const zone of zones) {
                        mapped[zone.id] = {
                            id: zone.id, branchId: zone.sucursal_id, name: zone.name,
                            color: zone.color || "#3b82f6", coordinates: zone.coordinates || [],
                            deliveryFee: parseFloat(zone.delivery_fee),
                            minOrderAmount: parseFloat(zone.min_order_amount || 0),
                            estimatedTimeMin: zone.estimated_time_min, isActive: zone.is_active,
                        }
                    }
                    setDeliveryZones(mapped)
                }
            }
        } catch {
            toast.error("Error cargando pedidos")
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        try { localStorage.removeItem("driverId"); localStorage.removeItem("driverName") } catch {}
        try { sessionStorage.removeItem("driverId"); sessionStorage.removeItem("driverName") } catch {}
        router.push("/driver")
    }

    const handleSetEnRoute = async (orderId: string) => {
        if (!driverId) return
        setEnRoutingId(orderId)
        const result = await setOrderEnRoute(orderId, driverId)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("¡En camino! El cliente fue notificado")
            loadOrders(driverId)
        }
        setEnRoutingId(null)
    }

    const handleDeliver = async (orderId: string) => {
        if (!driverId) return
        setDeliveringId(orderId)
        const result = await completeDriverOrder(orderId, driverId)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Pedido entregado")
            loadOrders(driverId)
        }
        setDeliveringId(null)
    }

    const handleNavigate = (order: Order) => {
        if (order.addressLat && order.addressLng) {
            // Navigate in-app: focus the embedded map and fit it to the full route
            mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
            setNavFocus((n) => n + 1)
        } else {
            // No GPS coordinates — fall back to external maps using the address
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.address || "")}`, "_blank")
        }
    }

    const enRouteOrder = orders.find((o) => o.status === "en_route") ?? null
    const pendingOrders = orders.filter((o) => o.status === "ready")
    const completedOrders = orders.filter((o) => o.status === "delivered")

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">Cargando...</p>
            </div>
        )
    }

    return (
        <GoogleMapsProvider>
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                    <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-lg truncate">Hola, {driverName}</h1>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                    {pendingOrders.length} pendiente{pendingOrders.length !== 1 ? "s" : ""}
                                    {enRouteOrder ? " · 1 en camino" : ""}
                                </p>
                                {locationStatus === "active" && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                                        <Locate className="h-3 w-3 mr-1" />GPS activo
                                    </Badge>
                                )}
                                {locationStatus === "fallback" && (
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        <Wifi className="h-3 w-3 mr-1" />Ubicación aprox.
                                    </Badge>
                                )}
                                {locationStatus === "error" && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                        <AlertCircle className="h-3 w-3 mr-1" />GPS sin acceso
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                <main className="max-w-md mx-auto px-4 py-4 space-y-5">
                    {storageError && (
                        <Card className="rounded-2xl border-orange-200 bg-orange-50">
                            <CardContent className="p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-orange-800 font-medium">Modo privado detectado</p>
                                    <p className="text-xs text-orange-700 mt-1">Tu sesión no se guardará si cerrás el navegador.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {error && error.code === error.PERMISSION_DENIED && (
                        <Card className="rounded-2xl border-orange-200 bg-orange-50">
                            <CardContent className="p-4">
                                <p className="text-sm text-orange-800">
                                    <strong>Ubicación desactivada:</strong> Activá el GPS para que los clientes puedan seguir tu ubicación.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* ── En camino ── */}
                    {enRouteOrder && (
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                <h2 className="text-sm font-bold uppercase tracking-wide text-primary">
                                    En camino
                                </h2>
                            </div>

                            <Card ref={mapSectionRef} className="rounded-2xl overflow-hidden border-primary/30 ring-2 ring-primary/20 shadow-md scroll-mt-20">
                                {/* Map */}
                                {enRouteOrder.addressLat && enRouteOrder.addressLng ? (
                                    <LiveTrackingMap
                                        orderId={enRouteOrder.id}
                                        driverId={driverId ?? undefined}
                                        initialDriverLocation={lastLocation}
                                        destination={{
                                            lat: enRouteOrder.addressLat,
                                            lng: enRouteOrder.addressLng,
                                            address: enRouteOrder.address,
                                        }}
                                        branchLocation={branchLocations[enRouteOrder.branchId]}
                                        height="220px"
                                        focusSignal={navFocus}
                                    />
                                ) : (
                                    <div className="h-32 bg-muted flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">Sin coordenadas GPS</p>
                                    </div>
                                )}

                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <span className="text-2xl font-black">#{enRouteOrder.orderNumber}</span>
                                            <Badge className="ml-2 bg-primary/10 text-primary border-primary/20">
                                                En camino
                                            </Badge>
                                        </div>
                                        <span className="text-sm font-semibold">{formatPrice(enRouteOrder.total)}</span>
                                    </div>

                                    {enRouteOrder.deliveryZoneId && deliveryZones[enRouteOrder.deliveryZoneId] && (
                                        <div className="flex items-center gap-2 text-sm mb-2">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: deliveryZones[enRouteOrder.deliveryZoneId].color }}
                                            />
                                            <span className="font-medium">{deliveryZones[enRouteOrder.deliveryZoneId].name}</span>
                                            {deliveryZones[enRouteOrder.deliveryZoneId].estimatedTimeMin && (
                                                <span className="text-muted-foreground">
                                                    ~{deliveryZones[enRouteOrder.deliveryZoneId].estimatedTimeMin} min
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    <div className="space-y-1.5 mb-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="h-4 w-4 shrink-0" />
                                            <span className="line-clamp-2">{enRouteOrder.address || "Sin dirección"}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-4 w-4 shrink-0" />
                                            <span>{enRouteOrder.customerPhone}</span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" className="flex-1 rounded-xl" asChild>
                                            <Link href={`tel:${enRouteOrder.customerPhone}`}>Llamar</Link>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 rounded-xl"
                                            onClick={() => handleNavigate(enRouteOrder)}
                                        >
                                            <Navigation className="h-4 w-4 mr-1.5" />
                                            Navegar
                                        </Button>
                                        <Button
                                            className="flex-1 rounded-xl"
                                            disabled={deliveringId === enRouteOrder.id}
                                            onClick={() => handleDeliver(enRouteOrder.id)}
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                            Entregar
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    )}

                    {/* ── Pendientes ── */}
                    {(pendingOrders.length > 0 || (!enRouteOrder && pendingOrders.length === 0)) && (
                        <section>
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                                    Pendientes
                                </h2>
                                <Badge variant="outline" className="text-xs">{pendingOrders.length}</Badge>
                            </div>

                            {pendingOrders.length === 0 ? (
                                <Card className="rounded-2xl border-dashed border-2">
                                    <CardContent className="py-8 text-center">
                                        <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                        <p className="text-sm text-muted-foreground">
                                            {enRouteOrder ? "Entregá el pedido actual para ver los siguientes" : "No hay entregas pendientes"}
                                        </p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="space-y-3">
                                    {pendingOrders.map((order) => (
                                        <Card key={order.id} className="rounded-2xl overflow-hidden">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <span className="text-xl font-bold">#{order.orderNumber}</span>
                                                        {order.deliveryZoneId && deliveryZones[order.deliveryZoneId] && (
                                                            <Badge variant="outline" className="ml-2 text-xs"
                                                                style={{
                                                                    borderColor: deliveryZones[order.deliveryZoneId].color,
                                                                    color: deliveryZones[order.deliveryZoneId].color,
                                                                }}
                                                            >
                                                                {deliveryZones[order.deliveryZoneId].name}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">{formatPrice(order.total)}</span>
                                                </div>

                                                <div className="space-y-1.5 mb-4 text-sm text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-4 w-4 shrink-0" />
                                                        <span className="line-clamp-1">{order.address || "Sin dirección"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="h-4 w-4 shrink-0" />
                                                        <span>{order.customerPhone}</span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="sm" className="rounded-xl" asChild>
                                                        <Link href={`tel:${order.customerPhone}`}>
                                                            <Phone className="h-3.5 w-3.5" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        className="flex-1 rounded-xl gap-1.5"
                                                        disabled={!!enRouteOrder || enRoutingId === order.id}
                                                        onClick={() => handleSetEnRoute(order.id)}
                                                    >
                                                        <Truck className="h-4 w-4" />
                                                        {enRoutingId === order.id ? "..." : "Me dirijo aquí"}
                                                    </Button>
                                                </div>

                                                {enRouteOrder && (
                                                    <p className="mt-2 text-xs text-center text-muted-foreground">
                                                        Entregá el pedido actual primero
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* ── Completadas hoy ── */}
                    {completedOrders.length > 0 && (
                        <section>
                            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                                Completadas hoy
                            </h2>
                            <Card className="rounded-2xl">
                                <CardContent className="p-0">
                                    {completedOrders.slice(0, 5).map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between p-4 border-b last:border-0 border-border"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">Pedido #{order.orderNumber}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{order.address || "Retiro"}</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium shrink-0">{formatPrice(order.total)}</span>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </section>
                    )}
                </main>
            </div>
        </GoogleMapsProvider>
    )
}
