"use client"

import { useState, useEffect, useMemo } from "react"
import useSWR from "swr"
import {
  Clock,
  ChefHat,
  Package,
  Phone,
  ArrowRight,
  Truck,
  Store,
  UtensilsCrossed,
  MapPin,
  Bike,
  User,
  UserCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import type { Branch, Order, OrderStatus, Driver, DeliveryZone } from "@/lib/types"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { updateOrderStatus, assignDriver, assignDriverBatch } from "@/app/actions"
import { PrintReceiptButton } from "@/components/receipt/order-receipt"
import { playNewOrderSound, unlockAudio } from "@/lib/sounds"
import { useActiveBranch } from "../branch-context"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function getElapsedMs(createdAt: string, now: number, readyAt?: string): number {
  const started = new Date(createdAt).getTime()
  const ended = readyAt ? new Date(readyAt).getTime() : now
  return Math.max(0, ended - started)
}

function formatElapsedTime(createdAt: string, now: number, readyAt?: string): string {
  const elapsed = getElapsedMs(createdAt, now, readyAt)
  const minutes = Math.floor(elapsed / 60000)
  const seconds = Math.floor((elapsed % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`
  }
  return `${(meters / 1000).toFixed(1)}km`
}

function clusterOrders(
  orders: Order[],
  maxDistance: number = 1500
): Map<string, Order[]> {
  if (orders.length === 0) return new Map()

  const clusters = new Map<string, Order[]>()
  const assigned = new Set<string>()
  let clusterCount = 0

  orders.forEach((order) => {
    if (
      assigned.has(order.id) ||
      order.addressLat === null ||
      order.addressLat === undefined ||
      order.addressLng === null ||
      order.addressLng === undefined
    )
      return

    const clusterId = `cluster-${clusterCount++}`
    const cluster: Order[] = [order]
    assigned.add(order.id)

    orders.forEach((otherOrder) => {
      if (
        assigned.has(otherOrder.id) ||
        otherOrder.addressLat === null ||
        otherOrder.addressLat === undefined ||
        otherOrder.addressLng === null ||
        otherOrder.addressLng === undefined
      )
        return

      const distance = calculateDistance(
        order.addressLat as number,
        order.addressLng as number,
        otherOrder.addressLat as number,
        otherOrder.addressLng as number
      )

      if (distance <= maxDistance) {
        cluster.push(otherOrder)
        assigned.add(otherOrder.id)
      }
    })

    clusters.set(clusterId, cluster)
  })

  return clusters
}

// ─── Order Card ────────────────────────────────────────────────

function OrderCard({
  order,
  nextStatus,
  buttonText = "Siguiente",
  now,
  updating,
  onNext,
  onReject,
  showAssign,
  driver,
  deliveryDrivers = [],
  onDeliveryDepart,
  departing = false,
  branch,
}: {
  order: Order
  nextStatus?: OrderStatus
  buttonText?: string
  now: number
  updating: boolean
  onNext?: () => void
  onReject?: () => void
  showAssign?: boolean
  driver?: Driver | null
  deliveryDrivers?: Driver[]
  onDeliveryDepart?: (orderId: string, driverId: string) => void
  departing?: boolean
  branch?: Branch | null
}) {
  const [selectedDriverId, setSelectedDriverId] = useState(order.driverId || "")
  const fulfillmentIcon = {
    delivery: Truck,
    pickup: Store,
    dine_in: UtensilsCrossed,
  }[order.deliveryMethod] || Store

  const fulfillmentLabel = {
    delivery: "Delivery",
    pickup: "Retiro",
    dine_in: "En local",
  }[order.deliveryMethod] || "Retiro"

  const FulfillmentIcon = fulfillmentIcon
  const isDeliveryDispatch = order.deliveryMethod === "delivery" && Boolean(onDeliveryDepart)
  const activeDrivers = deliveryDrivers.filter((d) => d.isActive)
  const availableDrivers = activeDrivers.filter((d) => d.isAvailable)
  const unavailableDrivers = activeDrivers.filter((d) => !d.isAvailable)
  const isReady = order.status === "ready"
  const elapsedTime = formatElapsedTime(order.createdAt, now, isReady ? order.readyAt : undefined)

  useEffect(() => {
    setSelectedDriverId(order.driverId || "")
  }, [order.driverId])

  return (
    <Card
      data-order-id={order.id}
      className={cn(
        "group w-full min-w-0 overflow-hidden rounded-2xl border-border bg-card py-0 shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background hover:shadow-md",
        updating && "opacity-50 pointer-events-none",
        departing && "scale-[0.98] opacity-0 blur-[1px]",
      )}
    >
      <CardHeader className="p-3.5 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <span
              className="block text-3xl font-black leading-none text-foreground"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              #{order.orderNumber}
            </span>
          </div>
          <div
            className={cn(
              "flex max-w-[112px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-base font-black leading-none",
              isReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-muted text-foreground"
            )}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Clock className="h-4 w-4" />
            <span>{elapsedTime}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3.5 pt-0">
        <div className="mb-2 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-sm font-medium text-muted-foreground">
          <User className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate font-bold text-foreground">{order.customerName}</span>
          {order.customerPhone && (
            <>
              <span className="shrink-0 text-muted-foreground/45">·</span>
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[90px] shrink truncate">{order.customerPhone}</span>
            </>
          )}
          {order.deliveryMethod === "delivery" && order.address && (
            <>
              <span className="shrink-0 text-muted-foreground/45">·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 truncate">{order.address}</span>
            </>
          )}
        </div>

        <div className="mb-2 min-w-0 space-y-1 overflow-hidden rounded-xl border border-border/70 bg-muted/45 p-2.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex min-w-0 justify-between text-sm leading-snug">
              <div className="min-w-0 max-w-full overflow-hidden">
                <span className="font-bold text-foreground">
                  {item.quantity}x
                </span>{" "}
                <span className="font-semibold text-foreground/80">
                  {item.name}
                  {item.variantName && (
                    <span className="text-muted-foreground"> · {item.variantName}</span>
                  )}
                </span>
                {item.modifiers?.length > 0 && (
                  <p className="ml-5 mt-0.5 line-clamp-2 max-w-[calc(100%-1.25rem)] break-words text-xs leading-snug text-muted-foreground">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
                {item.note && (
                  <p className="ml-5 mt-0.5 line-clamp-2 max-w-[calc(100%-1.25rem)] break-words text-xs italic leading-snug text-amber-700">
                    ✎ {item.note}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {isDeliveryDispatch && (
          <div className="mb-2 rounded-2xl border border-border bg-muted/35 p-2.5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              <Bike className="h-3.5 w-3.5" />
              Delivery
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
                disabled={updating || activeDrivers.length === 0}
              >
                <SelectTrigger className="h-9 w-full rounded-full border-border bg-background text-foreground hover:bg-muted/50">
                  <SelectValue placeholder="Seleccionar delivery" />
                </SelectTrigger>
                <SelectContent className="border-border bg-card">
                  {availableDrivers.length > 0 && (
                    <>
                      {availableDrivers.map((availableDriver) => (
                        <SelectItem key={availableDriver.id} value={availableDriver.id}>
                          {availableDriver.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {unavailableDrivers.length > 0 && (
                    <>
                      {unavailableDrivers.map((unavailableDriver) => (
                        <SelectItem key={unavailableDriver.id} value={unavailableDriver.id}>
                          {unavailableDriver.name} - no disponible
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-9 rounded-full bg-primary px-4 font-bold text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.24)] transition-transform hover:scale-[1.03] hover:bg-primary/90 active:scale-95"
                disabled={!selectedDriverId || updating}
                onClick={() => onDeliveryDepart?.(order.id, selectedDriverId)}
              >
                Salio!
              </Button>
            </div>
            {driver && (
              <p className="mt-2 text-xs font-medium text-chart-3">
                Asignado a {driver.name}
              </p>
            )}
            {activeDrivers.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                No hay repartidores activos.
              </p>
            )}
          </div>
        )}

        {/* Driver badge if assigned */}
        {driver && !isDeliveryDispatch && (
          <div className="mb-2 flex items-center gap-1.5 rounded-full border border-chart-2/20 bg-chart-2/10 px-2.5 py-1.5 text-xs text-chart-2">
            <Bike className="h-3.5 w-3.5" />
            <span className="font-medium">{driver.name}</span>
          </div>
        )}

        <div className="mt-auto flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
          <div className="min-w-0 flex-1 basis-[132px]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <FulfillmentIcon className="h-3 w-3" />
              <span className="uppercase tracking-[0.14em]">{fulfillmentLabel}</span>
            </div>
            <span className="mt-0.5 text-base font-extrabold leading-none text-foreground">
              {formatPrice(order.total)}
            </span>
          </div>

          <PrintReceiptButton order={order} branch={branch} variant="ghost" label="" />

          {(onReject || (onNext && nextStatus)) && (
            <div className="ml-auto flex min-w-0 items-center gap-2 max-[420px]:w-full">
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 rounded-full border-destructive/30 px-3 text-sm font-bold text-destructive hover:bg-destructive/10 active:scale-95 max-[420px]:flex-1"
                  onClick={onReject}
                >
                  Rechazar
                </Button>
              )}
              {onNext && nextStatus && (
                <Button
                  size="sm"
                  className="h-9 max-w-full shrink-0 rounded-full bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.24)] hover:bg-primary/90 active:scale-95 max-[420px]:flex-1"
                  onClick={onNext}
                >
                  <span className="truncate">{buttonText}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {showAssign && !isDeliveryDispatch && !nextStatus && !driver && (
            <Badge
              variant="outline"
              className="rounded-full border-dashed border-border bg-muted text-xs text-muted-foreground"
            >
              Sin asignar
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Ready Column with grouping ────────────────────────────────

function ReadyColumn({
  orders,
  zones,
  drivers,
  now,
  updatingId,
  onMarkDelivered,
  branch,
  selectedOrders,
  onToggleSelect,
  onSelectZone,
  onOpenAssign,
}: {
  orders: Order[]
  zones: DeliveryZone[]
  drivers: Driver[]
  now: number
  updatingId: string | null
  onMarkDelivered: (orderId: string) => void
  branch?: Branch | null
  selectedOrders: Set<string>
  onToggleSelect: (orderId: string, checked: boolean) => void
  onSelectZone: (zoneId: string, orderIds: string[]) => void
  onOpenAssign: (orderIds: string[]) => void
}) {
  const driverMap = useMemo(() => {
    const map = new Map<string, Driver>()
    drivers.forEach((d) => map.set(d.id, d))
    return map
  }, [drivers])

  const deliveryOrders = orders.filter((o) => o.deliveryMethod === "delivery")
  const pickupOrders = orders.filter(
    (o) => o.deliveryMethod === "pickup" || o.deliveryMethod === "dine_in"
  )

  const ordersByCluster = useMemo(() => {
    const ordersWithCoords = deliveryOrders.filter(
      (o) => o.addressLat && o.addressLng
    )
    const ordersWithoutCoords = deliveryOrders.filter(
      (o) => !o.addressLat || !o.addressLng
    )

    const clusters = clusterOrders(ordersWithCoords, 1500)

    // Add orders without coordinates to a special group
    if (ordersWithoutCoords.length > 0) {
      clusters.set("sin-coordenadas", ordersWithoutCoords)
    }

    return clusters
  }, [deliveryOrders])

  const selectedDeliveryIds = deliveryOrders
    .filter((o) => selectedOrders.has(o.id))
    .map((o) => o.id)

  if (orders.length === 0) {
    return (
      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/35 p-6 text-center text-muted-foreground">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-card">
          <Package className="h-5 w-5 opacity-60" />
        </div>
        <p className="text-sm font-semibold">Sin pedidos</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
      {/* ── Delivery orders grouped by proximity ── */}
      {deliveryOrders.length > 0 && (
        <div className="min-w-0 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Delivery
            </span>
            {selectedDeliveryIds.length > 0 ? (
              <button
                onClick={() => onOpenAssign(selectedDeliveryIds)}
                className="ml-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-[0_4px_12px_rgba(255,56,56,0.3)] transition-transform hover:bg-primary/90 active:scale-95"
              >
                <UserCheck className="h-3 w-3" />
                Asignar ({selectedDeliveryIds.length})
              </button>
            ) : (
              <Badge variant="outline" className="ml-auto rounded-full border-border bg-card text-xs text-muted-foreground">
                {deliveryOrders.length}
              </Badge>
            )}
          </div>

          {Array.from(ordersByCluster.entries()).map(([clusterId, clusterOrders]) => {
            const clusterOrderIds = clusterOrders.map((o) => o.id)
            const allClusterSelected = clusterOrderIds.every((id) => selectedOrders.has(id))
            const isSpecialGroup = clusterId === "sin-coordenadas"
            const clusterLabel = isSpecialGroup
              ? "Sin coordenadas"
              : `Zona ${clusterId.replace("cluster-", "")}`

            return (
              <div key={clusterId} className="min-w-0 space-y-2 overflow-hidden">
                {/* Cluster header — click to select all in group */}
                <div
                  className="flex cursor-pointer items-center gap-2 rounded-2xl border border-border px-3 py-2 transition-opacity hover:opacity-80"
                  style={{
                    backgroundColor: "hsl(var(--secondary))",
                    borderLeft: `3px solid hsl(var(--chart-2))`,
                  }}
                  onClick={() => onSelectZone(clusterId, clusterOrderIds)}
                >
                  <Checkbox
                    checked={allClusterSelected}
                    onCheckedChange={() => onSelectZone(clusterId, clusterOrderIds)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: "hsl(var(--chart-2))" }} />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
                    {clusterLabel}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {clusterOrders.length} orden{clusterOrders.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Orders in this cluster */}
                {clusterOrders.map((order) => {
                  const driver = order.driverId ? driverMap.get(order.driverId) || null : null
                  const isSelected = selectedOrders.has(order.id)

                  return (
                    <Card
                      key={order.id}
                      className={cn(
                        "w-full min-w-0 overflow-hidden rounded-2xl border-border bg-card shadow-sm transition-all duration-200",
                        updatingId === order.id && "pointer-events-none opacity-50",
                        isSelected && "border-primary bg-primary/[0.04]"
                      )}
                    >
                      <CardContent className="p-3.5">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(c) => onToggleSelect(order.id, c as boolean)}
                            className="mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span
                                className="text-2xl font-black leading-none text-foreground"
                                style={{ fontFamily: "var(--font-heading)" }}
                              >
                                #{order.orderNumber}
                              </span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatElapsedTime(order.createdAt, now, order.readyAt)}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{order.customerName}</p>
                            {order.address && (
                              <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span className="truncate">{order.address}</span>
                              </p>
                            )}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="font-extrabold text-foreground">
                                {formatPrice(order.total)}
                              </span>
                              {driver ? (
                                <span className="flex items-center gap-1 rounded-full border border-chart-2/20 bg-chart-2/10 px-2.5 py-1 text-xs font-medium text-chart-2">
                                  <Bike className="h-3 w-3" />
                                  {driver.name}
                                </span>
                              ) : (
                                <Badge variant="outline" className="rounded-full border-dashed border-border text-xs text-muted-foreground">
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
            )
          })}
        </div>
      )}

      {/* ── Pickup / Dine-in orders ── */}
      {pickupOrders.length > 0 && (
        <div className="min-w-0 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Retiro / En local
            </span>
            <Badge variant="outline" className="ml-auto rounded-full border-border bg-card text-xs text-muted-foreground">
              {pickupOrders.length}
            </Badge>
          </div>

          {pickupOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              updating={updatingId === order.id}
              departing={false}
              nextStatus="delivered"
              buttonText="Entregado"
              onNext={() => onMarkDelivered(order.id)}
              branch={branch}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Driver Assignment Sheet ───────────────────────────────────

function DriverAssignSheet({
  open,
  onOpenChange,
  orderIds,
  drivers,
  onAssign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderIds: string[]
  drivers: Driver[]
  onAssign: (driverId: string) => void
}) {
  const availableDrivers = drivers.filter((d) => d.isActive && d.isAvailable)
  const offlineDrivers = drivers.filter((d) => d.isActive && !d.isAvailable)

  const vehicleIcon = {
    motorcycle: "🏍️",
    bicycle: "🚲",
    car: "🚗",
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>
            Asignar repartidor
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            {orderIds.length} orden{orderIds.length !== 1 ? "es" : ""}{" "}
            seleccionada{orderIds.length !== 1 ? "s" : ""}
          </p>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Available drivers */}
          {availableDrivers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                Disponibles
              </p>
              {availableDrivers.map((driver) => (
                <button
                  key={driver.id}
                  onClick={() => onAssign(driver.id)}
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
                  <div className="h-2 w-2 rounded-full bg-chart-2 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* Offline drivers */}
          {offlineDrivers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                No disponibles
              </p>
              {offlineDrivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 opacity-50"
                >
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg">
                    {vehicleIcon[driver.vehicleType || "motorcycle"]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground truncate">
                      {driver.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {driver.phone}
                    </p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                </div>
              ))}
            </div>
          )}

          {drivers.filter((d) => d.isActive).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Bike className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay drivers registrados</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ─────────────────────────────────────────────────

type Column = {
  id: string
  label: string
  icon: any
  color: string
  headerTint: string
  iconClassName: string
  statuses: OrderStatus[]
  nextStatus?: OrderStatus
  buttonText?: string
}

const COLUMNS: Column[] = [
  {
    id: "new",
    label: "Nuevos",
    icon: Clock,
    color: "border-orange-200 bg-orange-50 text-orange-700",
    headerTint: "from-orange-50",
    iconClassName: "border-orange-200 bg-orange-50 text-orange-700",
    statuses: ["new"],
    nextStatus: "ready",
    buttonText: "Aceptar",
  },
  {
    id: "in-progress",
    label: "En cocina",
    icon: ChefHat,
    color: "border-amber-200 bg-amber-50 text-amber-700",
    headerTint: "from-amber-50",
    iconClassName: "border-amber-200 bg-amber-50 text-amber-700",
    statuses: ["accepted", "preparing"],
    nextStatus: "ready",
    buttonText: "Listo",
  },
  {
    id: "ready",
    label: "Listos",
    icon: Package,
    color: "border-emerald-200 bg-emerald-50 text-emerald-700",
    headerTint: "from-emerald-50",
    iconClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    statuses: ["ready"],
  },
]

export default function OrdersPage() {
  const { activeBranchId, branches } = useActiveBranch()
  const selectedBranch = activeBranchId ?? ""
  const { data: dispatchData, mutate } = useSWR<{
    orders: Order[]
    zones: DeliveryZone[]
    drivers: Driver[]
  }>(selectedBranch ? `/api/admin?type=dispatch&branchId=${selectedBranch}` : null, fetcher)

  const [orders, setOrders] = useState<Order[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      document.removeEventListener("click", unlock)
    }
    document.addEventListener("click", unlock)
    return () => document.removeEventListener("click", unlock)
  }, [])

  useEffect(() => {
    if (dispatchData) {
      setOrders(dispatchData.orders || [])
      setZones(dispatchData.zones || [])
      setDrivers(dispatchData.drivers || [])
    }
  }, [dispatchData])

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            playNewOrderSound()
            toast.info(`Nuevo pedido #${payload.new.order_number}`, {
              description: "Revisar y aceptar en mostrador",
              duration: 12000,
            })
            mutate()
          } else if (payload.eventType === "UPDATE") {
            setOrders((current) =>
              current.map((order) =>
                order.id === payload.new.id
                  ? { ...order, ...payload.new, status: payload.new.status, driverId: payload.new.driver_id }
                  : order
              )
            )
          }
        }
      )
      .subscribe()

    // Also listen for driver availability changes
    const driverChannel = supabase
      .channel("admin-drivers")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers" },
        () => {
          mutate()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(driverChannel)
    }
  }, [mutate])

  const handleNextStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const changedAt = new Date().toISOString()

    setUpdatingId(orderId)
    const orderToUpdate = orders.find((o) => o.id === orderId)
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: nextStatus,
              acceptedAt: nextStatus === "accepted" ? changedAt : order.acceptedAt,
              preparingAt: nextStatus === "preparing" ? changedAt : order.preparingAt,
              readyAt: nextStatus === "ready" ? changedAt : order.readyAt,
              deliveredAt: nextStatus === "delivered" ? changedAt : order.deliveredAt,
            }
          : order
      )
    )

    const result = await updateOrderStatus(orderId, nextStatus)

    if (result.error) {
      toast.error(result.error)
      mutate()
    } else if (nextStatus === "ready" && orderToUpdate) {
      setTimeout(() => {
        const printButton = document.querySelector(
          `[data-order-id="${orderId}"] [data-print-button]`
        ) as HTMLButtonElement
        if (printButton) printButton.click()
      }, 500)
    }

    setUpdatingId(null)
  }

  const handleMarkDelivered = async (orderId: string) => {
    await handleNextStatus(orderId, "delivered")
  }

  const handleReject = async (orderId: string, orderNumber?: number) => {
    if (!window.confirm(`¿Rechazar el pedido #${orderNumber}?`)) return
    await handleNextStatus(orderId, "cancelled")
  }

  const handleToggleSelect = (orderId: string, checked: boolean) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(orderId)
      } else {
        next.delete(orderId)
      }
      return next
    })
  }

  const handleSelectZone = (zoneId: string, orderIds: string[]) => {
    const allSelected = orderIds.every((id) => selectedOrders.has(id))
    setSelectedOrders((prev) => {
      const next = new Set(prev)
      orderIds.forEach((id) => {
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

    // Optimistic update
    setOrders((current) =>
      current.map((order) =>
        ids.includes(order.id) ? { ...order, driverId } : order
      )
    )

    let result
    if (ids.length === 1) {
      result = await assignDriver(ids[0], driverId)
    } else {
      result = await assignDriverBatch(ids, driverId)
    }

    if (result.error) {
      toast.error(result.error)
      mutate()
    } else {
      const driverName =
        drivers.find((d) => d.id === driverId)?.name || "Repartidor"
      toast.success(
        `${driverName} asignado a ${ids.length} orden${ids.length !== 1 ? "es" : ""}`
      )
    }

    setSelectedOrders(new Set())
    setAssignOrderIds([])
  }

  const selectedBranchInfo = useMemo(
    () => branches.find((b) => b.id === selectedBranch) || null,
    [branches, selectedBranch]
  )

  // Filter out delivered/cancelled/en_route from active view
  const activeOrders = useMemo(
    () =>
      (Array.isArray(orders) ? orders : []).filter(
        (o) =>
          o.status !== "delivered" &&
          o.status !== "cancelled" &&
          o.status !== "en_route" &&
          !(o.status === "ready" && o.deliveryMethod === "delivery" && o.driverId)
      ),
    [orders]
  )

  return (
    <div className="flex min-h-0 flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Pedidos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestiona la operacion activa en tiempo real
          </p>
        </div>
        <div className="flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-chart-3 shadow-[0_0_18px_rgba(34,197,94,0.7)]" />
          Actualizacion en vivo
        </div>
      </div>

      <div className="grid min-h-0 grid-cols-[repeat(3,minmax(280px,1fr))] gap-4 overflow-x-auto pb-3 snap-x xl:gap-5">
        {COLUMNS.map((col) => {
          const colOrders = activeOrders.filter((o) =>
            col.statuses.includes(o.status)
          )
          const ColIcon = col.icon
          const isReadyCol = col.id === "ready"

          return (
            <div
              key={col.id}
              className="flex h-[calc(100dvh-14rem)] min-h-[420px] min-w-[280px] max-h-[680px] max-w-full snap-center flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              {/* Column header */}
              <div
                className={cn(
                  "border-b border-border bg-gradient-to-b to-card px-4 py-3.5",
                  col.headerTint
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-full border",
                        col.iconClassName
                      )}
                    >
                      <ColIcon className="h-4 w-4" />
                    </span>
                    <h2
                      className="truncate text-sm font-bold uppercase tracking-[0.1em] text-foreground"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {col.label}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-7 rounded-full px-2.5 text-xs font-bold tabular-nums",
                      col.color,
                      col.id === "new" && colOrders.length > 0 && "animate-pulse ring-2 ring-orange-400"
                    )}
                  >
                    {colOrders.length}
                  </Badge>
                </div>
              </div>

              {/* Column body */}
              <ScrollArea className="min-h-0 flex-1 p-3 [scrollbar-gutter:stable]">
                {isReadyCol ? (
                  <ReadyColumn
                    orders={colOrders}
                    zones={zones}
                    drivers={drivers}
                    now={now}
                    updatingId={updatingId}
                    onMarkDelivered={handleMarkDelivered}
                    branch={selectedBranchInfo}
                    selectedOrders={selectedOrders}
                    onToggleSelect={handleToggleSelect}
                    onSelectZone={handleSelectZone}
                    onOpenAssign={handleOpenAssign}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
                    {colOrders.length === 0 ? (
                      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/35 p-6 text-center text-muted-foreground">
                        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-border bg-card">
                          <ColIcon className="h-5 w-5 opacity-60" />
                        </div>
                        <p className="text-sm font-semibold">Sin pedidos</p>
                      </div>
                    ) : (
                      colOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          nextStatus={col.nextStatus}
                          buttonText={col.buttonText}
                          now={now}
                          updating={updatingId === order.id}
                          departing={false}
                          onNext={
                            col.nextStatus
                              ? () =>
                                  handleNextStatus(order.id, col.nextStatus!)
                              : undefined
                          }
                          onReject={
                            col.id === "new"
                              ? () =>
                                  handleReject(order.id, order.orderNumber)
                              : undefined
                          }
                          branch={selectedBranchInfo}
                        />
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          )
        })}
      </div>

      {/* Driver assignment sheet */}
      <DriverAssignSheet
        open={assignSheetOpen}
        onOpenChange={setAssignSheetOpen}
        orderIds={assignOrderIds}
        drivers={drivers}
        onAssign={handleAssignDriver}
      />
    </div>
  )
}
