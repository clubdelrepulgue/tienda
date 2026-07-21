"use client"

import { useEffect, useMemo, useState } from "react"
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps"
import { createClient } from "@/lib/supabase/client"
import type { Driver, DeliveryZone, Order } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bike, Package, Clock, Navigation, Gauge, Signal, MapPin, Phone } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { BranchLogoMarker } from "./branch-logo-marker"
import { Polygon } from "./polygon"

interface DriversOverviewMapProps {
    height?: string
    /** Delivery zones to draw as polygons on the map */
    zones?: DeliveryZone[]
    /** Orders to plot as customer markers on the map */
    orders?: Order[]
}

interface DriverWithLocation extends Driver {
    activeOrder?: {
        id: string
        orderNumber: number
        address: string
        status: string
    }
}

const defaultCenter = { lat: -34.9011, lng: -56.1645 }

function DriverMarker({
    driver,
    isSelected,
    onClick,
}: {
    driver: DriverWithLocation
    isSelected: boolean
    onClick: () => void
}) {
    if (!driver.currentLocation) return null

    const color = driver.activeOrder
        ? "bg-blue-500"
        : driver.isAvailable
        ? "bg-green-500"
        : "bg-gray-500"

    const hasHeading = driver.currentLocation.heading != null
    const isStale =
        driver.currentLocation.updatedAt &&
        Date.now() - new Date(driver.currentLocation.updatedAt).getTime() > 5 * 60 * 1000

    return (
        <AdvancedMarker
            position={{
                lat: driver.currentLocation.lat,
                lng: driver.currentLocation.lng,
            }}
            title={driver.name}
            onClick={onClick}
        >
            <div className={`relative ${isSelected ? "z-10" : ""}`}>
                {/* Accuracy circle — shown when accuracy > 50m */}
                {driver.currentLocation.accuracy != null &&
                    driver.currentLocation.accuracy > 50 && (
                        <div
                            className="absolute rounded-full bg-current/10 border border-current/20"
                            style={{
                                width: `${Math.min(driver.currentLocation.accuracy * 0.5, 60)}px`,
                                height: `${Math.min(driver.currentLocation.accuracy * 0.5, 60)}px`,
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                                color: driver.activeOrder
                                    ? "#3b82f6"
                                    : driver.isAvailable
                                    ? "#22c55e"
                                    : "#6b7280",
                            }}
                        />
                    )}

                {driver.activeOrder && (
                    <div className="absolute -inset-2 bg-blue-500/30 rounded-full animate-pulse" />
                )}

                <div
                    className={`relative h-10 w-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform ${color} ${
                        isSelected ? "scale-125" : ""
                    } ${isStale ? "opacity-50" : ""}`}
                    style={
                        hasHeading
                            ? { transform: `rotate(${driver.currentLocation.heading}deg)${isSelected ? " scale(1.25)" : ""}` }
                            : undefined
                    }
                >
                    {hasHeading ? (
                        <Navigation className="h-5 w-5 text-white" />
                    ) : (
                        <Bike className="h-5 w-5 text-white" />
                    )}
                </div>

                {driver.activeOrder && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-white">
                        <Package className="h-3 w-3" />
                    </div>
                )}

                {/* Stale indicator */}
                {isStale && (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-yellow-500 rounded-full flex items-center justify-center border border-white">
                        <Clock className="h-2.5 w-2.5 text-white" />
                    </div>
                )}
            </div>
        </AdvancedMarker>
    )
}

function OrderMarker({
    order,
    color,
    isSelected,
    onClick,
}: {
    order: Order
    color: string
    isSelected: boolean
    onClick: () => void
}) {
    if (order.addressLat == null || order.addressLng == null) return null

    return (
        <AdvancedMarker
            position={{ lat: order.addressLat, lng: order.addressLng }}
            title={`#${order.orderNumber} · ${order.customerName}`}
            onClick={onClick}
        >
            <div
                className={`relative flex items-center justify-center rounded-full shadow-md border-2 border-white transition-transform ${
                    isSelected ? "h-8 w-8 scale-110 z-10" : "h-6 w-6"
                } ${order.driverId ? "" : "ring-2 ring-white/70"}`}
                style={{ backgroundColor: color }}
            >
                <MapPin className="h-3.5 w-3.5 text-white" />
            </div>
        </AdvancedMarker>
    )
}

export function DriversOverviewMap({ height = "500px", zones = [], orders = [] }: DriversOverviewMapProps) {
    const [drivers, setDrivers] = useState<DriverWithLocation[]>([])
    const [selectedDriver, setSelectedDriver] = useState<DriverWithLocation | null>(null)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [branchLocation, setBranchLocation] = useState<{ lat: number; lng: number; logo?: string; accentColor?: string } | null>(null)

    useEffect(() => {
        const supabase = createClient()

        const parseLocation = (loc: any) =>
            loc
                ? {
                      lat: parseFloat(loc.lat),
                      lng: parseFloat(loc.lng),
                      accuracy: loc.accuracy != null ? parseFloat(loc.accuracy) : null,
                      heading: loc.heading != null ? parseFloat(loc.heading) : null,
                      speed: loc.speed != null ? parseFloat(loc.speed) : null,
                      updatedAt: loc.updated_at,
                  }
                : undefined

        const fetchDrivers = async () => {
            const { data: driversData } = await supabase
                .from("drivers")
                .select("*")
                .eq("is_active", true)

            if (!driversData) {
                setLoading(false)
                return
            }

            const driversWithOrders = await Promise.all(
                driversData.map(async (driver) => {
                    const { data: orders } = await supabase
                        .from("orders")
                        .select("id, order_number, address_text, status")
                        .eq("driver_id", driver.id)
                        .eq("status", "ready")
                        .order("driver_assigned_at", { ascending: false })
                        .limit(1)

                    return {
                        ...driver,
                        currentLocation: parseLocation(driver.current_location),
                        activeOrder: orders?.[0]
                            ? {
                                  id: orders[0].id,
                                  orderNumber: orders[0].order_number,
                                  address: orders[0].address_text,
                                  status: orders[0].status,
                              }
                            : undefined,
                    }
                })
            )

            setDrivers(driversWithOrders)
            setLoading(false)
        }

        fetchDrivers()

        const fetchBranchLocation = async () => {
            const { data } = await supabase
                .from("sucursales")
                .select("location, logo_url, accent_color")
                .limit(1)
                .single()

            if (data?.location) {
                setBranchLocation({
                    lat: parseFloat(data.location.lat),
                    lng: parseFloat(data.location.lng),
                    logo: data.logo_url || "/assets/brand/logo.jpeg",
                    accentColor: data.accent_color || "#f97316",
                })
            }
        }

        fetchBranchLocation()

        const channel = supabase
            .channel("drivers-overview")
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "drivers",
                },
                (payload) => {
                    const updatedDriver = payload.new as any
                    setDrivers((prev) =>
                        prev.map((d) =>
                            d.id === updatedDriver.id
                                ? {
                                      ...d,
                                      currentLocation: updatedDriver.current_location
                                          ? parseLocation(updatedDriver.current_location)
                                          : d.currentLocation,
                                      isAvailable: updatedDriver.is_available,
                                  }
                                : d
                        )
                    )
                }
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                () => {
                    fetchDrivers()
                }
            )
            .subscribe()

        // Safety-net polling so driver positions stay live even if a realtime
        // event is missed (realtime UPDATE above is the primary driver).
        const pollId = setInterval(fetchDrivers, 10000)

        return () => {
            clearInterval(pollId)
            supabase.removeChannel(channel)
        }
    }, [])

    const driversWithLocation = drivers.filter((d) => d.currentLocation)

    // NOTE: `Map` here is the Google Maps component import, so use plain
    // objects for lookups instead of the JS Map constructor.
    const zoneById = useMemo(() => {
        const lookup: Record<string, DeliveryZone> = {}
        zones.forEach((z) => { lookup[z.id] = z })
        return lookup
    }, [zones])

    // Only delivery orders with real GPS coordinates can be plotted
    const mappableOrders = useMemo(
        () => orders.filter((o) => o.addressLat != null && o.addressLng != null),
        [orders]
    )

    const driverById = useMemo(() => {
        const lookup: Record<string, DriverWithLocation> = {}
        drivers.forEach((d) => { lookup[d.id] = d })
        return lookup
    }, [drivers])

    const center =
        driversWithLocation.length > 0
            ? {
                  lat:
                      driversWithLocation.reduce((sum, d) => sum + d.currentLocation!.lat, 0) /
                      driversWithLocation.length,
                  lng:
                      driversWithLocation.reduce((sum, d) => sum + d.currentLocation!.lng, 0) /
                      driversWithLocation.length,
              }
            : defaultCenter

    if (loading) {
        return (
            <div
                style={{ height }}
                className="rounded-xl border border-border bg-muted flex items-center justify-center"
            >
                <p className="text-muted-foreground">Cargando repartidores...</p>
            </div>
        )
    }

    // Accuracy quality label
    const getAccuracyLabel = (accuracy: number | null) => {
        if (accuracy == null) return null
        if (accuracy <= 10) return { text: "Excelente", color: "text-green-600" }
        if (accuracy <= 30) return { text: "Buena", color: "text-green-500" }
        if (accuracy <= 100) return { text: "Moderada", color: "text-yellow-500" }
        return { text: "Baja", color: "text-red-500" }
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold">{drivers.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-green-600">
                            {drivers.filter((d) => d.isAvailable).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Disponibles</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-blue-600">
                            {drivers.filter((d) => d.activeOrder).length}
                        </p>
                        <p className="text-xs text-muted-foreground">En entrega</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-500">
                            {drivers.filter((d) => !d.currentLocation).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Sin ubicación</p>
                    </CardContent>
                </Card>
            </div>

            {/* Map */}
            <div className="relative">
                <div style={{ height }} className="rounded-xl overflow-hidden border border-border">
                    <Map
                        defaultCenter={center}
                        defaultZoom={14}
                        gestureHandling="greedy"
                        disableDefaultUI={false}
                        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_ID || "DEMO_MAP_ID"}
                    >
                        {/* Delivery zones */}
                        {zones.map((zone) =>
                            zone.coordinates && zone.coordinates.length > 2 ? (
                                <Polygon
                                    key={zone.id}
                                    paths={zone.coordinates}
                                    strokeColor={zone.color || "#3b82f6"}
                                    fillColor={zone.color || "#3b82f6"}
                                    fillOpacity={0.12}
                                    strokeWeight={2}
                                />
                            ) : null
                        )}

                        {/* Order markers */}
                        {mappableOrders.map((order) => {
                            const zone = order.deliveryZoneId ? zoneById[order.deliveryZoneId] : undefined
                            return (
                                <OrderMarker
                                    key={order.id}
                                    order={order}
                                    color={zone?.color || "#ef4444"}
                                    isSelected={selectedOrder?.id === order.id}
                                    onClick={() => { setSelectedOrder(order); setSelectedDriver(null) }}
                                />
                            )
                        })}

                        {/* Branch logo marker */}
                        {branchLocation && (
                            <BranchLogoMarker
                                position={{ lat: branchLocation.lat, lng: branchLocation.lng }}
                                title="El Club del Repulge"
                                logoUrl={branchLocation.logo || "/assets/brand/logo.jpeg"}
                                size={60}
                                accentColor={branchLocation.accentColor || "#f97316"}
                                zIndex={10}
                            />
                        )}

                        {driversWithLocation.map((driver) => (
                            <DriverMarker
                                key={driver.id}
                                driver={driver}
                                isSelected={selectedDriver?.id === driver.id}
                                onClick={() => { setSelectedDriver(driver); setSelectedOrder(null) }}
                            />
                        ))}
                    </Map>
                </div>

                {/* Driver info panel */}
                {selectedDriver && (
                    <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-lg">{selectedDriver.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                    {selectedDriver.phone}
                                </p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <Badge
                                        variant={
                                            selectedDriver.isAvailable ? "default" : "secondary"
                                        }
                                    >
                                        {selectedDriver.isAvailable
                                            ? "Disponible"
                                            : "No disponible"}
                                    </Badge>
                                    {selectedDriver.activeOrder && (
                                        <Badge variant="outline" className="bg-blue-50">
                                            <Package className="h-3 w-3 mr-1" />
                                            Pedido #{selectedDriver.activeOrder.orderNumber}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDriver(null)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>

                        {selectedDriver.activeOrder && (
                            <div className="mt-3 pt-3 border-t border-border">
                                <p className="text-sm font-medium">Entregando a:</p>
                                <p className="text-sm text-muted-foreground">
                                    {selectedDriver.activeOrder.address || "Retiro en local"}
                                </p>
                            </div>
                        )}

                        {/* GPS info row */}
                        {selectedDriver.currentLocation && (
                            <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                                {selectedDriver.currentLocation.updatedAt && (
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDistanceToNow(
                                            new Date(selectedDriver.currentLocation.updatedAt),
                                            { addSuffix: true, locale: es }
                                        )}
                                    </div>
                                )}
                                {selectedDriver.currentLocation.accuracy != null && (
                                    <div className="flex items-center gap-1">
                                        <Signal className="h-3 w-3" />
                                        <span>±{Math.round(selectedDriver.currentLocation.accuracy)}m</span>
                                        {(() => {
                                            const label = getAccuracyLabel(selectedDriver.currentLocation!.accuracy)
                                            return label ? (
                                                <span className={label.color}>({label.text})</span>
                                            ) : null
                                        })()}
                                    </div>
                                )}
                                {selectedDriver.currentLocation.speed != null && (
                                    <div className="flex items-center gap-1">
                                        <Gauge className="h-3 w-3" />
                                        {(selectedDriver.currentLocation.speed * 3.6).toFixed(0)} km/h
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Order info panel */}
                {selectedOrder && (
                    <div className="absolute bottom-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-border">
                        <div className="flex items-start justify-between">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-lg">
                                        Pedido #{selectedOrder.orderNumber}
                                    </h3>
                                    {selectedOrder.deliveryZoneId && zoneById[selectedOrder.deliveryZoneId] && (
                                        <Badge
                                            variant="outline"
                                            style={{
                                                borderColor: zoneById[selectedOrder.deliveryZoneId].color,
                                                color: zoneById[selectedOrder.deliveryZoneId].color,
                                            }}
                                        >
                                            {zoneById[selectedOrder.deliveryZoneId].name}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    {selectedOrder.customerName}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-sm text-muted-foreground">
                            {selectedOrder.address && (
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    <span className="line-clamp-2">{selectedOrder.address}</span>
                                </div>
                            )}
                            {selectedOrder.customerPhone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <a href={`tel:${selectedOrder.customerPhone}`} className="hover:text-foreground">
                                        {selectedOrder.customerPhone}
                                    </a>
                                </div>
                            )}
                            <div className="flex items-center gap-2 pt-1">
                                {selectedOrder.driverId && driverById[selectedOrder.driverId] ? (
                                    <Badge variant="outline" className="bg-blue-50">
                                        <Bike className="h-3 w-3 mr-1" />
                                        {driverById[selectedOrder.driverId].name}
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-dashed">
                                        Sin repartidor asignado
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
