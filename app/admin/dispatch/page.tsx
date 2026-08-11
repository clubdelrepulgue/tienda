"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import {
  Package,
  Phone,
  Truck,
  Store,
  UtensilsCrossed,
  MapPin,
  Bike,
  UserCheck,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import type { Order, Driver, DeliveryZone } from "@/lib/types"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { updateOrderStatus, assignDriver, assignDriverBatch } from "@/app/actions"
import { formatZoneMeta } from "@/lib/delivery-zones"
import { GoogleMapsProvider, DriversOverviewMap } from "@/components/maps"
import { useActiveBranch } from "../branch-context"
import { getDriverPresence, formatAge, type DriverPresence } from "@/lib/driver-presence"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function DispatchPage() {
  const { activeBranchId } = useActiveBranch()
  const { data, mutate } = useSWR<{
    orders: Order[]
    zones: DeliveryZone[]
    drivers: Driver[]
  }>(
    activeBranchId
      ? `/api/admin?type=dispatch&branchId=${activeBranchId}`
      : "/api/admin?type=dispatch",
    fetcher,
    {
      // Realtime updates below drive most refreshes; this polling acts as a
      // safety net so the board stays live even if a realtime event is missed.
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  )

  const [orders, setOrders] = useState<Order[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      setOrders(data.orders || [])
      setZones(data.zones || [])
      setDrivers(data.drivers || [])
    }
  }, [data])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("dispatch-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => mutate()
      )
      .subscribe()

    const driverChannel = supabase
      .channel("dispatch-drivers")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers" },
        () => mutate()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(driverChannel)
    }
  }, [mutate])

  // Only ready orders
  const readyOrders = useMemo(
    () => (Array.isArray(orders) ? orders : []).filter((o) => o.status === "ready"),
    [orders]
  )

  const deliveryOrders = readyOrders.filter((o) => o.deliveryMethod === "delivery")
  const pickupOrders = readyOrders.filter(
    (o) => o.deliveryMethod === "pickup" || o.deliveryMethod === "dine_in"
  )

  const zoneMap = useMemo(() => {
    const map = new Map<string, DeliveryZone>()
    zones.forEach((z) => map.set(z.id, z))
    return map
  }, [zones])

  const driverMap = useMemo(() => {
    const map = new Map<string, Driver>()
    drivers.forEach((d) => map.set(d.id, d))
    return map
  }, [drivers])

  // Reloj propio para que la presencia envejezca en pantalla aunque no llegue
  // ningún evento (un repartidor que se queda sin batería no genera eventos).
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setPresenceNow(Date.now()), 10000)
    return () => clearInterval(id)
  }, [])

  const { assignableDrivers, unavailableDrivers } = useMemo(() => {
    const assignable: { driver: Driver; presence: DriverPresence }[] = []
    const unavailable: { driver: Driver; presence: DriverPresence; reason: string }[] = []

    for (const driver of drivers) {
      if (!driver.isActive) continue

      const presence = getDriverPresence(
        {
          isActive: driver.isActive,
          isOnShift: driver.isOnShift,
          lastSeenAt: driver.lastSeenAt,
          locationUpdatedAt: driver.currentLocation?.updatedAt,
        },
        presenceNow
      )

      if (presence.assignable && driver.isAvailable) {
        assignable.push({ driver, presence })
        continue
      }

      const reason = !presence.assignable
        ? `${presence.label} · ${formatAge(presence.ageMs)}`
        : "Ocupado con otro pedido"
      unavailable.push({ driver, presence, reason })
    }

    // El más "fresco" primero: es el que más probablemente conteste.
    assignable.sort((a, b) => (a.presence.ageMs ?? Infinity) - (b.presence.ageMs ?? Infinity))

    return { assignableDrivers: assignable, unavailableDrivers: unavailable }
  }, [drivers, presenceNow])

  const ordersByZone = useMemo(() => {
    const groups = new Map<string, Order[]>()
    deliveryOrders.forEach((order) => {
      const key = order.deliveryZoneId || "sin-zona"
      const arr = groups.get(key) || []
      arr.push(order)
      groups.set(key, arr)
    })
    return groups
  }, [deliveryOrders])

  const handleToggleSelect = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (checked) next.add(orderId)
      else next.delete(orderId)
      return next
    })
  }

  const handleSelectZone = (zoneId: string) => {
    const zoneOrders = ordersByZone.get(zoneId) || []
    const zoneIds = zoneOrders.map((o) => o.id)
    const allSelected = zoneIds.every((id) => selectedOrders.has(id))

    setSelectedOrders((prev) => {
      const next = new Set(prev)
      zoneIds.forEach((id) => {
        if (allSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const handleOpenAssign = (orderIds: string[]) => {
    setAssignOrderIds(orderIds)
    setAssignSheetOpen(true)
  }

  const handleAssignDriver = async (driverId: string) => {
    setAssignSheetOpen(false)
    const ids = assignOrderIds

    setOrders((current) =>
      current.map((order) =>
        ids.includes(order.id) ? { ...order, driverId } : order
      )
    )

    const result =
      ids.length === 1
        ? await assignDriver(ids[0], driverId)
        : await assignDriverBatch(ids, driverId)

    if (result.error) {
      toast.error(result.error)
      mutate()
    } else {
      const driverName = drivers.find((d) => d.id === driverId)?.name || "Repartidor"
      toast.success(
        `${driverName} asignado a ${ids.length} orden${ids.length !== 1 ? "es" : ""}`
      )
    }

    setSelectedOrders(new Set())
    setAssignOrderIds([])
  }

  const handleMarkDelivered = async (orderId: string) => {
    setUpdatingId(orderId)
    setOrders((current) =>
      current.map((o) => (o.id === orderId ? { ...o, status: "delivered" as const } : o))
    )
    const result = await updateOrderStatus(orderId, "delivered")
    if (result.error) {
      toast.error(result.error)
      mutate()
    }
    setUpdatingId(null)
  }

  const selectedDeliveryCount = deliveryOrders.filter((o) =>
    selectedOrders.has(o.id)
  ).length

  const vehicleIcon: Record<string, string> = {
    motorcycle: "🏍️",
    bicycle: "🚲",
    car: "🚗",
  }

  return (
    <GoogleMapsProvider>
    <div className="flex flex-col gap-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Despacho y Seguimiento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Repartidores en vivo, zonas y pedidos en un solo lugar
          </p>
        </div>

        {selectedDeliveryCount > 0 && (
          <Button
            onClick={() =>
              handleOpenAssign(
                deliveryOrders
                  .filter((o) => selectedOrders.has(o.id))
                  .map((o) => o.id)
              )
            }
            className="gap-2"
          >
            <UserCheck className="h-4 w-4" />
            Asignar repartidor ({selectedDeliveryCount})
          </Button>
        )}
      </div>

      {/* ── Live map: drivers, zones & orders ── */}
      <DriversOverviewMap height="380px" zones={zones} orders={deliveryOrders} />

      <div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Delivery by zone ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <h2
                className="font-semibold text-foreground uppercase tracking-wide text-sm"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Delivery
              </h2>
              <Badge variant="outline" className="text-xs ml-auto">
                {deliveryOrders.length}
              </Badge>
            </div>

            {deliveryOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                <Truck className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No hay pedidos de delivery listos</p>
              </div>
            ) : (
              Array.from(ordersByZone.entries()).map(([zoneId, zoneOrders]) => {
                const zone = zoneMap.get(zoneId)
                const allSelected = zoneOrders.every((o) =>
                  selectedOrders.has(o.id)
                )

                return (
                  <div key={zoneId} className="space-y-2">
                    {/* Zone header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: zone
                          ? `${zone.color}15`
                          : "hsl(var(--secondary))",
                        borderLeft: `3px solid ${zone?.color || "hsl(var(--border))"}`,
                      }}
                      onClick={() => handleSelectZone(zoneId)}
                    >
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => handleSelectZone(zoneId)}
                        className="mr-1"
                      />
                      <MapPin
                        className="h-4 w-4"
                        style={{ color: zone?.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {zone?.name || "Sin zona"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {zoneOrders.length} orden{zoneOrders.length !== 1 ? "es" : ""}
                          </span>
                        </div>
                        {zone ? (
                          <p className="text-xs text-muted-foreground truncate">
                            {formatZoneMeta(zone)}
                          </p>
                        ) : (
                          <p className="text-xs text-destructive">
                            Revisar coordenadas o zona antes de asignar
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Orders */}
                    <div className="space-y-2 pl-2">
                      {zoneOrders.map((order) => {
                        const driver = order.driverId
                          ? driverMap.get(order.driverId) || null
                          : null

                        return (
                          <Card
                            key={order.id}
                            className={cn(
                              "rounded-xl bg-card border-border shadow-sm transition-all",
                              updatingId === order.id &&
                                "opacity-50 pointer-events-none",
                              selectedOrders.has(order.id) &&
                                "ring-2 ring-primary border-primary"
                            )}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedOrders.has(order.id)}
                                  onCheckedChange={(c) =>
                                    handleToggleSelect(order.id, c as boolean)
                                  }
                                  className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                                      #{order.orderNumber}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(
                                        order.createdAt
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium text-foreground">
                                    {order.customerName}
                                  </p>
                                  {order.address && (
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      <MapPin className="h-3 w-3 inline mr-1" />
                                      {order.address}
                                    </p>
                                  )}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] px-2 py-0.5"
                                      style={{
                                        borderColor: zone?.color || undefined,
                                        color: zone?.color || undefined,
                                      }}
                                    >
                                      {zone?.name || "Sin zona"}
                                    </Badge>
                                    {order.addressLat != null && order.addressLng != null ? (
                                      <span className="text-[11px] text-muted-foreground">
                                        GPS confirmado
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-destructive">
                                        Sin coordenadas
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between mt-2">
                                    <span className="font-semibold text-sm">
                                      {formatPrice(order.total)}
                                    </span>
                                    {driver ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs bg-chart-2/10 text-chart-2 rounded-lg px-2 py-1 border border-chart-2/20 flex items-center gap-1">
                                          <Bike className="h-3 w-3" />
                                          {driver.name}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 text-xs gap-1"
                                          onClick={() =>
                                            handleMarkDelivered(order.id)
                                          }
                                        >
                                          <Check className="h-3 w-3" />
                                          Entregado
                                        </Button>
                                      </div>
                                    ) : (
                                      <Badge
                                        variant="outline"
                                        className="text-xs border-dashed"
                                      >
                                        Sin asignar
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ── Pickup / Dine-in ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <h2
                className="font-semibold text-foreground uppercase tracking-wide text-sm"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Retiro / En local
              </h2>
              <Badge variant="outline" className="text-xs ml-auto">
                {pickupOrders.length}
              </Badge>
            </div>

            {pickupOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                <Store className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No hay pedidos de retiro listos</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pickupOrders.map((order) => {
                  const isPickup = order.deliveryMethod === "pickup"
                  const FIcon = isPickup ? Store : UtensilsCrossed
                  const fLabel = isPickup ? "Retiro" : "En local"

                  return (
                    <Card
                      key={order.id}
                      className={cn(
                        "rounded-xl bg-card border-border shadow-sm transition-all",
                        updatingId === order.id &&
                          "opacity-50 pointer-events-none"
                      )}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                              #{order.orderNumber}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <FIcon className="h-3 w-3" />
                              {fLabel}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {order.customerName}
                            </p>
                            <span className="font-semibold text-sm">
                              {formatPrice(order.total)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => handleMarkDelivered(order.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Entregado
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Driver assignment sheet */}
      <Sheet open={assignSheetOpen} onOpenChange={setAssignSheetOpen}>
        <SheetContent side="right" className="w-80 sm:w-96">
          <SheetHeader>
            <SheetTitle>Asignar repartidor</SheetTitle>
            <p className="text-sm text-muted-foreground">
              {assignOrderIds.length} orden{assignOrderIds.length !== 1 ? "es" : ""}{" "}
              seleccionada{assignOrderIds.length !== 1 ? "s" : ""}
            </p>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Asignables primero: conectados, con señal fresca y sin pedido
                encima. Antes bastaba con `is_available`, que es solo
                ocupado/libre — un repartidor con el celular apagado aparecía
                acá arriba como si estuviera esperando trabajo. */}
            {assignableDrivers.map(({ driver, presence }) => (
              <button
                key={driver.id}
                onClick={() => handleAssignDriver(driver.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-accent transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-chart-2/15 flex items-center justify-center text-lg">
                  {vehicleIcon[driver.vehicleType || "motorcycle"]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {driver.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {driver.phone}
                    {driver.vehiclePlate && ` · ${driver.vehiclePlate}`}
                  </p>
                </div>
                <Badge variant="outline" className={cn("shrink-0", presence.className)}>
                  <span
                    className="h-1.5 w-1.5 rounded-full mr-1.5"
                    style={{ backgroundColor: presence.dotColor }}
                  />
                  {presence.label}
                </Badge>
              </button>
            ))}

            {unavailableDrivers.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
                  No disponibles
                </p>
                {/* Siguen siendo asignables a propósito: el local muchas veces
                    coordina por teléfono y el sistema no debería impedirlo.
                    Lo que cambia es que ahora dice por qué no conviene. */}
                <div className="space-y-2">
                  {unavailableDrivers.map(({ driver, presence, reason }) => (
                    <button
                      key={driver.id}
                      onClick={() => handleAssignDriver(driver.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                    >
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg opacity-60">
                        {vehicleIcon[driver.vehicleType || "motorcycle"]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground truncate">
                          {driver.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{reason}</p>
                      </div>
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: presence.dotColor }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {drivers.filter((d) => d.isActive).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Bike className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay drivers registrados</p>
              </div>
            )}

            {drivers.filter((d) => d.isActive).length > 0 &&
              assignableDrivers.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Bike className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Ningún repartidor conectado ahora</p>
                  <p className="text-xs mt-1">
                    Podés asignar igual desde la lista de arriba si lo coordinás por teléfono.
                  </p>
                </div>
              )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </GoogleMapsProvider>
  )
}
