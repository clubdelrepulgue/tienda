"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    Package, MapPin, Phone, LogOut, Clock, Navigation,
    Locate, AlertCircle, Wifi, Truck, CheckCircle2, Power, WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { completeDriverOrder, setOrderEnRoute, setDriverShift, getDriverShiftState } from "@/app/actions"
import type { DeliveryZone, Order } from "@/lib/types"
import { toast } from "sonner"
import { useDriverLocation } from "@/hooks/use-driver-location"
import { GoogleMapsProvider, LiveTrackingMap } from "@/components/maps"
import { formatZoneMeta } from "@/lib/delivery-zones"
import { formatPrice } from "@/lib/utils"
import { unlockAudio, playChime, requestNotificationPermission } from "@/lib/notification-sound"
import { driverSnapshots, formatSnapshotAge } from "@/lib/offline-storage"
import { useConnectivity } from "@/hooks/use-connectivity"

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
    const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<number | null>(null)
    const [onShift, setOnShift] = useState(true)
    const [shiftSyncing, setShiftSyncing] = useState(false)
    const mapSectionRef = useRef<HTMLDivElement>(null)
    const knownOrderIdsRef = useRef<Set<string> | null>(null)
    const wasOnlineRef = useRef(true)
    const router = useRouter()
    const isOnline = useConnectivity()

    // El GPS solo corre en turno: así "conectado" es una decisión del
    // repartidor y no una inferencia del panel.
    const { lastLocation, locationStatus } = useDriverLocation({
        driverId,
        enabled: onShift,
        heartbeatMs: 15000,
        onError: (err) => {
            if (err.code === err.PERMISSION_DENIED) {
                toast.error("Habilitá la ubicación para que te vean en el mapa")
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

    // Entrar a la app = entrar en turno. El repartidor puede salir con el
    // switch del header; al salir dejamos de rastrear y el panel deja de
    // ofrecerlo para asignaciones (en vez de mostrarlo "Disponible" para
    // siempre, que es lo que pasaba antes).
    useEffect(() => {
        if (!driverId) return
        let cancelled = false

        const enterShift = async () => {
            const state = await getDriverShiftState(driverId)
            if (cancelled) return

            // Si ya estaba en turno respetamos ese estado; si no, lo abrimos.
            if (state.driver?.isOnShift === true) {
                setOnShift(true)
                return
            }

            const result = await setDriverShift(driverId, true)
            if (!cancelled && !result.error) setOnShift(true)
        }

        enterShift()
        return () => { cancelled = true }
    }, [driverId])

    const handleToggleShift = async (next: boolean) => {
        if (!driverId) return
        setShiftSyncing(true)
        // Optimista: el GPS arranca/para al instante, sin esperar al servidor.
        setOnShift(next)

        const result = await setDriverShift(driverId, next)
        if (result.error) {
            setOnShift(!next)
            toast.error("No se pudo cambiar el turno. Revisá tu conexión.")
        } else {
            toast.success(next ? "Estás en turno" : "Saliste de turno")
        }
        setShiftSyncing(false)
    }

    // El canal NO depende de `isOnline`: navigator.onLine parpadea al cambiar de
    // antena o entrar en un túnel, y reconstruir el canal en cada parpadeo
    // provocaba huecos de varios segundos. El cliente de Supabase ya reconecta
    // solo; nosotros solo forzamos un refetch al volver a foreground.
    useEffect(() => {
        if (!driverId) return
        const supabase = createClient()
        const channel = supabase
            .channel(`driver-orders-${driverId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                (payload) => {
                    const nextOrder = payload.new as { driver_id?: string }
                    const previousOrder = payload.old as { driver_id?: string }
                    // Solo recargamos si el cambio toca los pedidos de este
                    // repartidor. `payload.old.driver_id` requiere replica
                    // identity full en orders (migración 016); sin eso, una
                    // desasignación no llegaba nunca.
                    if (nextOrder?.driver_id === driverId || previousOrder?.driver_id === driverId) {
                        loadOrders(driverId)
                    }
                }
            )
            .subscribe()

        const refetchOnFocus = () => {
            if (document.visibilityState === "visible") loadOrders(driverId)
        }
        document.addEventListener("visibilitychange", refetchOnFocus)

        return () => {
            document.removeEventListener("visibilitychange", refetchOnFocus)
            supabase.removeChannel(channel)
        }
    }, [driverId])

    useEffect(() => {
        if (!wasOnlineRef.current && isOnline && driverId) {
            loadOrders(driverId)
        }
        wasOnlineRef.current = isOnline
    }, [driverId, isOnline])

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

    // Permiso de notificaciones: lo usa playChime() para avisar de un pedido
    // nuevo cuando la pestaña no está al frente.
    //
    // Acá antes se registraba un Service Worker propio (/sw.js) que hacía dos
    // cosas, las dos mal:
    //   - "tracking en background": imposible, la Geolocation API no existe en
    //     un Service Worker, nunca envió una posición.
    //   - Realtime de pedidos: solo se conectaba con la app VISIBLE, o sea
    //     exactamente cuando esta misma página ya está suscripta. Redundante.
    // Y, peor, se registraba en scope "/" igual que el SW de Serwist
    // (app/sw.ts), así que ambos se pisaban: cada uno desregistraba al otro y
    // el repartidor perdía el modo offline de forma intermitente.
    useEffect(() => {
        requestNotificationPermission()
    }, [])

    // Prevent context menu and copying on images
    useEffect(() => {
        const handleContextMenu = (e: MouseEvent | TouchEvent) => {
            if ((e.target as HTMLElement)?.tagName === 'IMG') {
                e.preventDefault()
                return false
            }
        }
        document.addEventListener("contextmenu", handleContextMenu as EventListener)
        return () => document.removeEventListener("contextmenu", handleContextMenu as EventListener)
    }, [])

    // Disable pinch-to-zoom on mobile
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 1) {
                e.preventDefault()
            }
        }
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault()
            }
        }

        document.addEventListener("touchstart", handleTouchStart, { passive: false })
        document.addEventListener("wheel", handleWheel, { passive: false })

        return () => {
            document.removeEventListener("touchstart", handleTouchStart)
            document.removeEventListener("wheel", handleWheel)
        }
    }, [])

    const loadOrders = async (id: string) => {
        try {
            if (!navigator.onLine) throw new Error("offline")
            const response = await fetch(`/api/driver/orders?driverId=${id}`)
            if (!response.ok) throw new Error("No se pudieron cargar los pedidos")
            const data = await response.json()
            if (!Array.isArray(data)) throw new Error("Respuesta de pedidos inválida")
            const list: Order[] = data
            setOrders(list)
            const nextBranchLocations: Record<string, { lat: number; lng: number }> = {}
            const nextDeliveryZones: Record<string, DeliveryZone> = {}

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
                    for (const b of branches) {
                        if (b.lat && b.lng) nextBranchLocations[b.id] = { lat: parseFloat(b.lat), lng: parseFloat(b.lng) }
                    }
                    setBranchLocations(nextBranchLocations)
                }
            }

            const zoneIds = [...new Set((data || []).map((o: Order) => o.deliveryZoneId).filter(Boolean))]
            if (zoneIds.length > 0) {
                const supabase = createClient()
                const { data: zones } = await supabase
                    .from("delivery_zones").select("*").in("id", zoneIds)
                if (zones) {
                    for (const zone of zones) {
                        nextDeliveryZones[zone.id] = {
                            id: zone.id, branchId: zone.sucursal_id, name: zone.name,
                            color: zone.color || "#3b82f6", coordinates: zone.coordinates || [],
                            deliveryFee: parseFloat(zone.delivery_fee),
                            minOrderAmount: parseFloat(zone.min_order_amount || 0),
                            estimatedTimeMin: zone.estimated_time_min, isActive: zone.is_active,
                        }
                    }
                    setDeliveryZones(nextDeliveryZones)
                }
            }

            const updatedAt = Date.now()
            setSnapshotUpdatedAt(updatedAt)
            await driverSnapshots.save(id, {
                orders: list,
                branchLocations: nextBranchLocations,
                deliveryZones: nextDeliveryZones,
            })
        } catch {
            try {
                const snapshot = await driverSnapshots.read(id)
                if (snapshot) {
                    setOrders(snapshot.orders)
                    setBranchLocations(snapshot.branchLocations)
                    setDeliveryZones(snapshot.deliveryZones)
                    setSnapshotUpdatedAt(snapshot.updatedAt)
                } else {
                    toast.error("No hay recorridos guardados en este dispositivo")
                }
            } catch {
                toast.error("No se pudieron recuperar los recorridos guardados")
            }
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        // Cerrar sesión cierra el turno: si no, el repartidor quedaría "en
        // turno" en el panel hasta que expire el heartbeat.
        if (driverId) {
            await setDriverShift(driverId, false).catch(() => {})
            await driverSnapshots.clear(driverId).catch(() => {})
        }
        try { localStorage.removeItem("driverId"); localStorage.removeItem("driverName") } catch {}
        try { sessionStorage.removeItem("driverId"); sessionStorage.removeItem("driverName") } catch {}
        router.push("/driver")
    }

    const handleSetEnRoute = async (orderId: string) => {
        if (!driverId) return
        if (!isOnline) {
            toast.error("Necesitás conexión para cambiar el estado del pedido")
            return
        }
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
        if (!isOnline) {
            toast.error("Necesitás conexión para marcar el pedido como entregado")
            return
        }
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
            if (mapSectionRef.current) {
                mapSectionRef.current.scrollIntoView({ behavior: "smooth", block: "center" })
                // Small delay to ensure map is visible before focusing
                setTimeout(() => setNavFocus((n) => n + 1), 300)
            } else {
                setNavFocus((n) => n + 1)
            }
            toast.success("Mostrando ruta en el mapa")
        } else {
            // Fallback: open external maps when no coordinates
            const destination = order.address || "destino"
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`, "_blank")
            toast.info("Abriendo Google Maps...")
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
            <div className="min-h-screen bg-background static-page">
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
                                {!onShift && (
                                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground">
                                        <Power className="h-3 w-3 mr-1" />Fuera de turno
                                    </Badge>
                                )}
                                {onShift && !isOnline && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                        <WifiOff className="h-3 w-3 mr-1" />Sin internet
                                    </Badge>
                                )}
                                {onShift && isOnline && locationStatus === "active" && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-600 border-green-200">
                                        <Locate className="h-3 w-3 mr-1" />En vivo
                                    </Badge>
                                )}
                                {onShift && isOnline && locationStatus === "degraded" && (
                                    <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-600 border-yellow-200">
                                        <Wifi className="h-3 w-3 mr-1" />Ubicación aprox.
                                    </Badge>
                                )}
                                {onShift && isOnline && locationStatus === "requesting" && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                                        <Locate className="h-3 w-3 mr-1 animate-pulse" />Buscando GPS
                                    </Badge>
                                )}
                                {onShift && locationStatus === "denied" && (
                                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                        <AlertCircle className="h-3 w-3 mr-1" />GPS bloqueado
                                    </Badge>
                                )}
                                {onShift && locationStatus === "error" && (
                                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                        <AlertCircle className="h-3 w-3 mr-1" />Sin señal GPS
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                            <div className="flex flex-col items-center gap-0.5 pr-1">
                                <Switch
                                    checked={onShift}
                                    disabled={shiftSyncing}
                                    onCheckedChange={handleToggleShift}
                                    aria-label="Entrar o salir de turno"
                                />
                                <span className="text-[10px] leading-none text-muted-foreground">
                                    Turno
                                </span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleLogout}>
                                <LogOut className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </header>

                <main className="max-w-md mx-auto px-4 py-4 space-y-5">
                    {!isOnline && snapshotUpdatedAt && (
                        <Card className="rounded-2xl border-amber-200 bg-amber-50">
                            <CardContent className="p-4 text-sm text-amber-900">
                                <p className="font-semibold">Mostrando el último recorrido guardado</p>
                                <p className="mt-1 text-xs">Actualizado {formatSnapshotAge(snapshotUpdatedAt)}. Los cambios de estado requieren conexión.</p>
                            </CardContent>
                        </Card>
                    )}
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

                    {!onShift && (
                        <Card className="rounded-2xl border-border bg-muted/40">
                            <CardContent className="p-4 flex gap-3">
                                <Power className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Estás fuera de turno</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        No se comparte tu ubicación y el local no te va a asignar
                                        pedidos nuevos. Activá el switch de arriba para volver.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {onShift && locationStatus === "denied" && (
                        <Card className="rounded-2xl border-orange-200 bg-orange-50">
                            <CardContent className="p-4">
                                <p className="text-sm text-orange-800">
                                    <strong>Ubicación bloqueada:</strong> el local no puede verte en el
                                    mapa ni asignarte pedidos. Habilitá la ubicación para este sitio
                                    en los ajustes del navegador.
                                </p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Mientras la app está en segundo plano no hay GPS para web
                        (ni en iOS ni en Android): avisamos en vez de fingir que
                        seguimos reportando. */}
                    {onShift && locationStatus === "error" && (
                        <Card className="rounded-2xl border-amber-200 bg-amber-50">
                            <CardContent className="p-4">
                                <p className="text-sm text-amber-900">
                                    <strong>Sin señal de GPS.</strong> Mantené esta pantalla abierta
                                    mientras repartís: si el celular se bloquea, dejás de aparecer en
                                    el mapa del local.
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
                                {isOnline && enRouteOrder.addressLat && enRouteOrder.addressLng ? (
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
                                    <div className="min-h-32 bg-muted flex flex-col items-center justify-center gap-1 p-4 text-center">
                                        <MapPin className="h-5 w-5 text-muted-foreground" />
                                        <p className="text-sm font-medium text-foreground">{enRouteOrder.address || "Sin dirección"}</p>
                                        {enRouteOrder.addressLat && enRouteOrder.addressLng && (
                                            <p className="text-xs text-muted-foreground">
                                                {enRouteOrder.addressLat.toFixed(5)}, {enRouteOrder.addressLng.toFixed(5)}
                                            </p>
                                        )}
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
                                            disabled={!isOnline || deliveringId === enRouteOrder.id}
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
                                                        disabled={!isOnline || !!enRouteOrder || enRoutingId === order.id}
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
