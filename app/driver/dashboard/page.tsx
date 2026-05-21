"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Package, MapPin, Phone, LogOut, Clock, Navigation, Locate, AlertCircle, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/client"
import { updateOrderStatus } from "@/app/actions"
import type { Order } from "@/lib/types"
import { toast } from "sonner"
import { useDriverLocation } from "@/hooks/use-driver-location"
import { GoogleMapsProvider, LiveTrackingMap } from "@/components/maps"

export default function DriverDashboardPage() {
    const [driverId, setDriverId] = useState<string | null>(null)
    const [driverName, setDriverName] = useState<string>("")
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [showMap, setShowMap] = useState(false)
    const [storageError, setStorageError] = useState(false)
    const [branchLocations, setBranchLocations] = useState<Record<string, { lat: number; lng: number }>>({})
    const router = useRouter()

    const { isTracking, lastLocation, error, locationStatus } = useDriverLocation({
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
        } catch {
            // localStorage no disponible
        }

        if (!id) {
            try {
                id = sessionStorage.getItem("driverId")
                name = sessionStorage.getItem("driverName")
                if (id) {
                    setStorageError(true)
                }
            } catch {
                // Ningún storage disponible
            }
        }

        if (!id) {
            router.push("/driver")
            return
        }

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
                { event: "*", schema: "public", table: "orders" },
                () => {
                    loadOrders(driverId)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [driverId])

    const loadOrders = async (id: string) => {
        try {
            const response = await fetch(`/api/driver/orders?driverId=${id}`)
            const data = await response.json()
            setOrders(data || [])

            // Fetch branch coordinates for orders that have them
            const branchIds = [...new Set((data || []).map((o: Order) => o.branchId).filter(Boolean))]
            if (branchIds.length > 0) {
                const supabase = createClient()
                const { data: branches } = await supabase
                    .from("sucursales")
                    .select("id, lat, lng")
                    .in("id", branchIds)

                if (branches) {
                    const locs: Record<string, { lat: number; lng: number }> = {}
                    for (const b of branches) {
                        if (b.lat && b.lng) {
                            locs[b.id] = { lat: parseFloat(b.lat), lng: parseFloat(b.lng) }
                        }
                    }
                    setBranchLocations(locs)
                }
            }
        } catch {
            toast.error("Error cargando pedidos")
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        try {
            localStorage.removeItem("driverId")
            localStorage.removeItem("driverName")
        } catch {}
        try {
            sessionStorage.removeItem("driverId")
            sessionStorage.removeItem("driverName")
        } catch {}
        router.push("/driver")
    }

    const handleStatusUpdate = async (orderId: string, status: string) => {
        const result = await updateOrderStatus(orderId, status)
        if (result.error) {
            toast.error(result.error)
        } else {
            toast.success("Estado actualizado")
            if (driverId) loadOrders(driverId)
            if (status === "delivered") {
                setSelectedOrder(null)
                setShowMap(false)
            }
        }
    }

    const handleNavigate = (order: Order) => {
        // Use coordinates for precision when available, fallback to address text
        if (order.addressLat && order.addressLng) {
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${order.addressLat},${order.addressLng}`,
                "_blank"
            )
        } else {
            const encodedAddress = encodeURIComponent(order.address || "")
            window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
                "_blank"
            )
        }
    }

    const activeOrders = orders.filter((o) => o.status === "ready")
    const completedOrders = orders.filter((o) => o.status === "delivered")

    // Check if selected order has real coordinates for LiveTrackingMap
    const selectedHasCoords = selectedOrder?.addressLat != null && selectedOrder?.addressLng != null

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
                <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
                    <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-lg truncate">Hola, {driverName}</h1>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs text-muted-foreground">
                                    {activeOrders.length} entregas pendientes
                                </p>
                                {locationStatus === "active" && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                                        <Locate className="h-3 w-3 mr-1" />
                                        GPS activo
                                    </Badge>
                                )}
                                {locationStatus === "fallback" && (
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        <Wifi className="h-3 w-3 mr-1" />
                                        Ubicación aprox.
                                    </Badge>
                                )}
                                {locationStatus === "requesting" && (
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        <Locate className="h-3 w-3 mr-1" />
                                        Obteniendo GPS...
                                    </Badge>
                                )}
                                {locationStatus === "error" && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        GPS sin acceso
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={handleLogout}>
                            <LogOut className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                <main className="max-w-md mx-auto px-4 py-4 space-y-4">
                    {storageError && (
                        <Card className="rounded-2xl border-orange-200 bg-orange-50">
                            <CardContent className="p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm text-orange-800 font-medium">Modo privado detectado</p>
                                    <p className="text-xs text-orange-700 mt-1">
                                        Estás en modo incógnito. Tu sesión no se guardará si cierras el navegador.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {error && error.code === error.PERMISSION_DENIED && (
                        <Card className="rounded-2xl border-orange-200 bg-orange-50">
                            <CardContent className="p-4">
                                <p className="text-sm text-orange-800">
                                    <strong>Ubicación desactivada:</strong> Activa el GPS para que los clientes puedan seguir tu ubicación.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Map with route — uses LiveTrackingMap when coordinates available */}
                    {showMap && selectedOrder && (
                        <Card className="rounded-2xl overflow-hidden">
                            <CardContent className="p-0">
                                <div className="p-4 border-b border-border flex items-center justify-between">
                                    <div className="min-w-0">
                                        <h3 className="font-bold">Pedido #{selectedOrder.orderNumber}</h3>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {selectedOrder.address || "Retiro en local"}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setShowMap(false)}>
                                        Cerrar
                                    </Button>
                                </div>

                                {selectedHasCoords ? (
                                    <LiveTrackingMap
                                        orderId={selectedOrder.id}
                                        driverId={driverId ?? undefined}
                                        destination={{
                                            lat: selectedOrder.addressLat!,
                                            lng: selectedOrder.addressLng!,
                                            address: selectedOrder.address,
                                        }}
                                        branchLocation={branchLocations[selectedOrder.branchId]}
                                        height="300px"
                                    />
                                ) : (
                                    <div className="h-[200px] bg-muted flex items-center justify-center">
                                        <p className="text-sm text-muted-foreground">
                                            Sin coordenadas — usa el botón Navegar
                                        </p>
                                    </div>
                                )}

                                <div className="p-4 flex gap-2">
                                    <Button
                                        variant="outline"
                                        className="flex-1 rounded-xl"
                                        onClick={() => handleNavigate(selectedOrder)}
                                    >
                                        <Navigation className="h-4 w-4 mr-2" />
                                        Navegar
                                    </Button>
                                    <Button
                                        className="flex-1 rounded-xl"
                                        onClick={() => handleStatusUpdate(selectedOrder.id, "delivered")}
                                    >
                                        Entregado
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <section>
                        <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                            Entregas Activas
                        </h2>

                        {activeOrders.length === 0 ? (
                            <Card className="rounded-2xl border-dashed border-2">
                                <CardContent className="py-8 text-center">
                                    <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
                                    <p className="text-sm text-muted-foreground">
                                        No hay entregas pendientes
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {activeOrders.map((order) => (
                                    <Card key={order.id} className="rounded-2xl overflow-hidden">
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <span className="text-2xl font-bold">
                                                        #{order.orderNumber}
                                                    </span>
                                                    <Badge variant="outline" className="ml-2">
                                                        Listo
                                                    </Badge>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    ${order.total.toFixed(2)}
                                                </span>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span className="line-clamp-2">
                                                        {order.address || "Retiro en local"}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <span>{order.customerPhone}</span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 rounded-xl"
                                                    asChild
                                                >
                                                    <Link href={`tel:${order.customerPhone}`}>
                                                        Llamar
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 rounded-xl"
                                                    onClick={() => {
                                                        setSelectedOrder(order)
                                                        setShowMap(true)
                                                    }}
                                                >
                                                    <MapPin className="h-4 w-4 mr-2" />
                                                    Ruta
                                                </Button>
                                                <Button
                                                    className="flex-1 rounded-xl"
                                                    onClick={() => handleStatusUpdate(order.id, "delivered")}
                                                >
                                                    Entregar
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </section>

                    {completedOrders.length > 0 && (
                        <section>
                            <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                                Completadas Hoy
                            </h2>
                            <Card className="rounded-2xl">
                                <CardContent className="p-0">
                                    {completedOrders.slice(0, 5).map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between p-4 border-b last:border-0 border-border"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                                                    <Package className="h-5 w-5 text-green-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium truncate">
                                                        Pedido #{order.orderNumber}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {order.address || "Retiro en local"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-medium shrink-0">
                                                ${order.total.toFixed(2)}
                                            </span>
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
