"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import { getDriverPresence, formatAge, type DriverPresence } from "@/lib/driver-presence"
import { useSmoothPosition } from "@/hooks/use-smooth-position"

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
    presence: DriverPresence
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
    // El marcador se anima entre lecturas para que el recorrido se lea como
    // un movimiento continuo en vez de saltos cada pocos segundos.
    const smooth = useSmoothPosition(
        driver.currentLocation
            ? { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng }
            : null
    )

    if (!driver.currentLocation || !smooth) return null

    const { presence } = driver
    const isDelivering = !!driver.activeOrder
    const disconnected = presence.level === "offline" || presence.level === "off_shift"

    // El color dice qué está haciendo; la opacidad y el reloj, si lo estamos
    // viendo en vivo. Antes ambas cosas se mezclaban en `is_available`.
    const color = disconnected
        ? "bg-gray-400"
        : isDelivering
        ? "bg-blue-500"
        : presence.level === "live"
        ? "bg-green-500"
        : "bg-amber-500"

    const hasHeading = driver.currentLocation.heading != null
    const showStale = presence.level === "stale" || presence.level === "weak"

    return (
        <AdvancedMarker
            position={smooth}
            title={`${driver.name} · ${presence.label}`}
            onClick={onClick}
            zIndex={isSelected ? 20 : presence.level === "live" ? 10 : 5}
        >
            <div className={`relative ${isSelected ? "z-10" : ""}`}>
                {/* Círculo de precisión — solo si el error supera los 50 m */}
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
                                color: presence.dotColor,
                            }}
                        />
                    )}

                {/* El pulso solo cuando la señal es fresca: si parpadea con datos
                    viejos, transmite una certeza que no tenemos. */}
                {presence.level === "live" && (
                    <div
                        className={`absolute -inset-2 rounded-full animate-ping ${
                            isDelivering ? "bg-blue-500/30" : "bg-green-500/25"
                        }`}
                    />
                )}

                <div
                    className={`relative h-10 w-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white ${color} ${
                        isSelected ? "scale-125" : ""
                    } ${disconnected ? "opacity-40" : showStale ? "opacity-70" : ""}`}
                    style={
                        hasHeading
                            ? {
                                  transform: `rotate(${driver.currentLocation.heading}deg)${
                                      isSelected ? " scale(1.25)" : ""
                                  }`,
                              }
                            : undefined
                    }
                >
                    {hasHeading ? (
                        <Navigation className="h-5 w-5 text-white" />
                    ) : (
                        <Bike className="h-5 w-5 text-white" />
                    )}
                </div>

                {isDelivering && (
                    <div className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold border-2 border-white">
                        <Package className="h-3 w-3" />
                    </div>
                )}

                {(showStale || disconnected) && (
                    <div
                        className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center border border-white"
                        style={{ backgroundColor: presence.dotColor }}
                    >
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

type RawDriver = Omit<DriverWithLocation, "presence">

export function DriversOverviewMap({ height = "500px", zones = [], orders = [] }: DriversOverviewMapProps) {
    const [rawDrivers, setRawDrivers] = useState<RawDriver[]>([])
    const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(true)
    const [branchLocation, setBranchLocation] = useState<{ lat: number; lng: number; logo?: string; accentColor?: string } | null>(null)
    /** Reloj propio: la presencia envejece sola aunque no lleguen eventos. */
    const [now, setNow] = useState(() => Date.now())
    const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "down">("connecting")

    const fetchDriversRef = useRef<(() => Promise<void>) | null>(null)

    useEffect(() => {
        const supabase = createClient()
        let disposed = false

        const fetchDrivers = async () => {
            // Una sola query para todos los repartidores y otra para todos sus
            // pedidos activos. Antes era una query de pedidos POR repartidor
            // (N+1) repetida cada 10 s.
            const { data: driversData } = await supabase
                .from("drivers")
                .select("*")
                .eq("is_active", true)

            if (disposed) return
            if (!driversData) {
                setLoading(false)
                return
            }

            // `en_route` es el estado en el que el repartidor realmente está
            // entregando. Filtrar solo por `ready` (como antes) hacía que quien
            // salió a repartir desapareciera del contador "En entrega" y
            // perdiera el pin azul.
            const { data: activeOrders } = await supabase
                .from("orders")
                .select("id, order_number, address_text, status, driver_id, driver_assigned_at")
                .in("driver_id", driversData.map((d) => d.id))
                .in("status", ["ready", "en_route"])
                .order("driver_assigned_at", { ascending: false })

            if (disposed) return

            const orderByDriver = new globalThis.Map<string, any>()
            for (const order of activeOrders || []) {
                if (!order.driver_id) continue
                const current = orderByDriver.get(order.driver_id)
                // en_route gana sobre ready: es el pedido que está en la calle.
                if (!current || (order.status === "en_route" && current.status !== "en_route")) {
                    orderByDriver.set(order.driver_id, order)
                }
            }

            setRawDrivers(
                driversData.map((driver) => {
                    const order = orderByDriver.get(driver.id)
                    return {
                        ...driver,
                        isActive: driver.is_active,
                        isAvailable: driver.is_available,
                        isOnShift: driver.is_on_shift ?? undefined,
                        lastSeenAt: driver.last_seen_at ?? null,
                        currentLocation: parseLocation(driver.current_location),
                        activeOrder: order
                            ? {
                                  id: order.id,
                                  orderNumber: order.order_number,
                                  address: order.address_text,
                                  status: order.status,
                              }
                            : undefined,
                    } as RawDriver
                })
            )
            setLoading(false)
        }

        fetchDriversRef.current = fetchDrivers
        fetchDrivers()

        const fetchBranchLocation = async () => {
            const { data } = await supabase
                .from("sucursales")
                .select("location, logo_url, accent_color")
                .limit(1)
                .single()

            if (disposed) return
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
                { event: "UPDATE", schema: "public", table: "drivers" },
                (payload) => {
                    const updated = payload.new as any
                    setRawDrivers((prev) => {
                        const known = prev.some((d) => d.id === updated.id)
                        // Repartidor que se activó después de la carga inicial:
                        // recargamos en vez de perder el evento (el `.map` de
                        // antes descartaba silenciosamente estos casos).
                        if (!known) {
                            if (updated.is_active) fetchDriversRef.current?.()
                            return prev
                        }
                        return prev.map((d) =>
                            d.id === updated.id
                                ? {
                                      ...d,
                                      isAvailable: updated.is_available,
                                      isActive: updated.is_active,
                                      isOnShift: updated.is_on_shift ?? d.isOnShift,
                                      lastSeenAt: updated.last_seen_at ?? d.lastSeenAt,
                                      currentLocation: updated.current_location
                                          ? parseLocation(updated.current_location)
                                          : d.currentLocation,
                                  }
                                : d
                        )
                    })
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                (payload) => {
                    // Solo recargamos si el cambio afecta la asignación o el
                    // estado de un pedido; el resto de los UPDATE de orders
                    // (totales, notas) no mueven este mapa.
                    const next = payload.new as any
                    const prev = payload.old as any
                    const touchesDispatch =
                        next?.driver_id !== prev?.driver_id || next?.status !== prev?.status
                    if (touchesDispatch || payload.eventType !== "UPDATE") {
                        fetchDriversRef.current?.()
                    }
                }
            )
            .subscribe((status) => {
                if (disposed) return
                if (status === "SUBSCRIBED") setRealtimeStatus("live")
                else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("down")
            })

        // Red de seguridad, no el mecanismo principal: si Realtime está sano no
        // hace falta refrescar seguido. Antes esto corría cada 10 s y competía
        // con los eventos, provocando parpadeo de los pines.
        const pollId = setInterval(() => {
            if (document.visibilityState === "visible") fetchDriversRef.current?.()
        }, 60_000)

        return () => {
            disposed = true
            clearInterval(pollId)
            fetchDriversRef.current = null
            supabase.removeChannel(channel)
        }
    }, [])

    // Si Realtime se cae, volvemos a poll agresivo para no dejar el panel ciego.
    useEffect(() => {
        if (realtimeStatus !== "down") return
        const id = setInterval(() => fetchDriversRef.current?.(), 10_000)
        return () => clearInterval(id)
    }, [realtimeStatus])

    // El "hace X" y el nivel de presencia tienen que envejecer en pantalla
    // aunque no llegue ningún evento nuevo.
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5_000)
        return () => clearInterval(id)
    }, [])

    const drivers: DriverWithLocation[] = useMemo(
        () =>
            rawDrivers.map((d) => ({
                ...d,
                presence: getDriverPresence(
                    {
                        isActive: d.isActive,
                        isOnShift: d.isOnShift,
                        lastSeenAt: d.lastSeenAt,
                        locationUpdatedAt: d.currentLocation?.updatedAt,
                    },
                    now
                ),
            })),
        [rawDrivers, now]
    )

    const selectedDriver = useMemo(
        () => drivers.find((d) => d.id === selectedDriverId) ?? null,
        [drivers, selectedDriverId]
    )

    const handleSelectDriver = useCallback((id: string) => {
        setSelectedDriverId(id)
        setSelectedOrder(null)
    }, [])

    const driversWithLocation = drivers.filter((d) => d.currentLocation)

    const connectedCount = drivers.filter(
        (d) => d.presence.level === "live" || d.presence.level === "weak"
    ).length
    const deliveringCount = drivers.filter((d) => d.activeOrder).length
    // "Libre ahora" = conectado, sin pedido encima y con señal confiable.
    const assignableCount = drivers.filter(
        (d) => d.presence.assignable && d.isAvailable && !d.activeOrder
    ).length
    const offlineCount = drivers.filter(
        (d) => d.presence.level === "offline" || d.presence.level === "stale"
    ).length

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
            {/* Stats — cada tarjeta responde una pregunta distinta:
                quién está conectado, quién puede recibir un pedido ahora,
                quién está entregando y a quién perdimos de vista. */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <div className="flex items-baseline gap-1.5">
                            <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
                            <span className="text-sm text-muted-foreground">/ {drivers.length}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Conectados</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-emerald-600">{assignableCount}</p>
                        <p className="text-xs text-muted-foreground">Libres ahora</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-blue-600">{deliveringCount}</p>
                        <p className="text-xs text-muted-foreground">En entrega</p>
                    </CardContent>
                </Card>
                <Card className="rounded-xl">
                    <CardContent className="p-4">
                        <p className="text-2xl font-bold text-gray-500">{offlineCount}</p>
                        <p className="text-xs text-muted-foreground">Sin señal</p>
                    </CardContent>
                </Card>
            </div>

            {realtimeStatus === "down" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Conexión en vivo interrumpida — actualizando cada 10 s hasta recuperarla.
                </div>
            )}

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
                                    onClick={() => { setSelectedOrder(order); setSelectedDriverId(null) }}
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
                                isSelected={selectedDriverId === driver.id}
                                onClick={() => handleSelectDriver(driver.id)}
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
                                    {/* Conexión y ocupación son cosas distintas:
                                        antes las dos salían del mismo flag y un
                                        repartidor con el celular apagado figuraba
                                        como "Disponible". */}
                                    <Badge
                                        variant="outline"
                                        className={selectedDriver.presence.className}
                                    >
                                        <span
                                            className="h-1.5 w-1.5 rounded-full mr-1.5"
                                            style={{ backgroundColor: selectedDriver.presence.dotColor }}
                                        />
                                        {selectedDriver.presence.label}
                                    </Badge>
                                    <Badge
                                        variant={
                                            selectedDriver.activeOrder ? "secondary" : "default"
                                        }
                                    >
                                        {selectedDriver.activeOrder ? "Ocupado" : "Libre"}
                                    </Badge>
                                    {selectedDriver.activeOrder && (
                                        <Badge variant="outline" className="bg-blue-50">
                                            <Package className="h-3 w-3 mr-1" />
                                            Pedido #{selectedDriver.activeOrder.orderNumber}
                                            {selectedDriver.activeOrder.status === "en_route" && " · en camino"}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDriverId(null)}
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
                                <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {/* El ping (last_seen_at) prueba que sigue conectado;
                                        la posición puede ser más vieja si está quieto. */}
                                    <span>Señal {formatAge(selectedDriver.presence.ageMs)}</span>
                                </div>
                                {selectedDriver.currentLocation.updatedAt && (
                                    <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
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
