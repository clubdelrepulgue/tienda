"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
  UserCheck,
  X,
  Check,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import type { Order, OrderStatus, Driver, DeliveryZone } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { updateOrderStatus, assignDriver, assignDriverBatch } from "@/app/actions"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// ─── Order Card ────────────────────────────────────────────────

function OrderCard({
  order,
  nextStatus,
  updating,
  onNext,
  showAssign,
  selectable,
  selected,
  onSelect,
  driver,
}: {
  order: Order
  nextStatus?: OrderStatus
  updating: boolean
  onNext?: () => void
  showAssign?: boolean
  selectable?: boolean
  selected?: boolean
  onSelect?: (checked: boolean) => void
  driver?: Driver | null
}) {
  const fulfillmentIcon = {
    delivery: Truck,
    pickup: Store,
    dine_in: UtensilsCrossed,
  }[order.deliveryMethod] || Store

  const fulfillmentLabel = {
    delivery: "Delivery",
    pickup: "Takeaway",
    dine_in: "Dine-in",
  }[order.deliveryMethod] || "Pickup"

  const FulfillmentIcon = fulfillmentIcon

  return (
    <Card
      className={cn(
        "rounded-xl bg-card border-border shadow-sm transition-all",
        updating && "opacity-50 pointer-events-none",
        selected && "ring-2 ring-primary border-primary"
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {selectable && (
              <Checkbox
                checked={selected}
                onCheckedChange={onSelect}
                className="mr-1"
              />
            )}
            <span className="text-xs font-mono font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
              #{order.orderNumber}
            </span>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <CardTitle className="text-base text-card-foreground">
          {order.customerName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Phone className="h-3.5 w-3.5" />
          {order.customerPhone}
        </div>

        {order.deliveryMethod === "delivery" && order.address && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="line-clamp-2">{order.address}</span>
          </div>
        )}

        <div className="space-y-1.5 mb-3">
          {order.items.map((item) => (
            <div key={item.id} className="text-sm flex justify-between">
              <div>
                <span className="font-medium text-foreground">
                  {item.quantity}x
                </span>{" "}
                <span className="text-muted-foreground">{item.name}</span>
                {item.modifiers?.length > 0 && (
                  <p className="text-xs text-muted-foreground/70 pl-5">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Driver badge if assigned */}
        {driver && (
          <div className="flex items-center gap-1.5 mb-3 text-xs bg-chart-2/10 text-chart-2 rounded-lg px-2.5 py-1.5 border border-chart-2/20">
            <Bike className="h-3.5 w-3.5" />
            <span className="font-medium">{driver.name}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FulfillmentIcon className="h-3 w-3" />
              <span className="uppercase tracking-wider">{fulfillmentLabel}</span>
            </div>
            <span className="font-semibold text-foreground text-sm">
              ${order.total.toFixed(2)}
            </span>
          </div>

          {onNext && nextStatus && (
            <Button
              size="sm"
              className="h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
              onClick={onNext}
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {showAssign && !nextStatus && !driver && (
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground border-dashed"
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
  updatingId,
  onMarkDelivered,
  onOpenAssign,
  selectedOrders,
  onToggleSelect,
}: {
  orders: Order[]
  zones: DeliveryZone[]
  drivers: Driver[]
  updatingId: string | null
  onMarkDelivered: (orderId: string) => void
  onOpenAssign: (orderIds: string[]) => void
  selectedOrders: Set<string>
  onToggleSelect: (orderId: string, checked: boolean) => void
}) {
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

  // Separate by fulfillment type
  const deliveryOrders = orders.filter((o) => o.deliveryMethod === "delivery")
  const pickupOrders = orders.filter(
    (o) => o.deliveryMethod === "pickup" || o.deliveryMethod === "dine_in"
  )

  // Group delivery orders by zone
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

  const selectedDeliveryInZone = (zoneId: string) => {
    const zoneOrders = ordersByZone.get(zoneId) || []
    return zoneOrders.filter((o) => selectedOrders.has(o.id))
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full border-2 border-dashed border-border/50 rounded-xl">
        <Package className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-sm font-medium">No orders</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Delivery orders grouped by zone ── */}
      {deliveryOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Delivery
            </span>
            <Badge variant="outline" className="text-xs ml-auto">
              {deliveryOrders.length}
            </Badge>
          </div>

          {Array.from(ordersByZone.entries()).map(([zoneId, zoneOrders]) => {
            const zone = zoneMap.get(zoneId)
            const selected = selectedDeliveryInZone(zoneId)

            return (
              <div key={zoneId} className="space-y-2">
                {/* Zone header */}
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: zone
                      ? `${zone.color}15`
                      : "hsl(var(--secondary))",
                    borderLeft: `3px solid ${zone?.color || "hsl(var(--border))"}`,
                  }}
                >
                  <MapPin
                    className="h-3.5 w-3.5"
                    style={{ color: zone?.color }}
                  />
                  <span className="text-xs font-semibold flex-1">
                    {zone?.name || "Sin zona"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {zoneOrders.length} orden{zoneOrders.length !== 1 ? "es" : ""}
                  </span>
                  {selected.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs gap-1 rounded-md"
                      onClick={() =>
                        onOpenAssign(selected.map((o) => o.id))
                      }
                    >
                      <UserCheck className="h-3 w-3" />
                      Asignar ({selected.length})
                    </Button>
                  )}
                </div>

                {/* Orders in this zone */}
                {zoneOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    updating={updatingId === order.id}
                    selectable
                    selected={selectedOrders.has(order.id)}
                    onSelect={(checked) =>
                      onToggleSelect(order.id, checked as boolean)
                    }
                    showAssign
                    driver={
                      order.driverId
                        ? driverMap.get(order.driverId) || null
                        : null
                    }
                    onNext={
                      order.driverId
                        ? () => onMarkDelivered(order.id)
                        : undefined
                    }
                    nextStatus={order.driverId ? "delivered" : undefined}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pickup / Dine-in orders ── */}
      {pickupOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Store className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pickup / Dine-in
            </span>
            <Badge variant="outline" className="text-xs ml-auto">
              {pickupOrders.length}
            </Badge>
          </div>

          {pickupOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updatingId === order.id}
              nextStatus="delivered"
              onNext={() => onMarkDelivered(order.id)}
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
            Asignar Driver
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
  statuses: OrderStatus[]
  nextStatus?: OrderStatus
}

const COLUMNS: Column[] = [
  {
    id: "pending",
    label: "Pending",
    icon: Clock,
    color: "bg-chart-1/15 text-chart-1 border-chart-1/20",
    statuses: ["new", "accepted"],
    nextStatus: "preparing",
  },
  {
    id: "preparing",
    label: "Preparing",
    icon: ChefHat,
    color: "bg-accent/15 text-accent border-accent/20",
    statuses: ["preparing"],
    nextStatus: "ready",
  },
  {
    id: "ready",
    label: "Ready",
    icon: Package,
    color: "bg-chart-3/15 text-chart-3 border-chart-3/20",
    statuses: ["ready"],
  },
]

export default function OrdersPage() {
  const { data: dispatchData, mutate } = useSWR<{
    orders: Order[]
    zones: DeliveryZone[]
    drivers: Driver[]
  }>("/api/admin?type=dispatch", fetcher)

  const [orders, setOrders] = useState<Order[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([])

  // Audio ref for notification
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3")
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
            toast.info("New order received!")
            audioRef.current?.play().catch(() => {})
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
    setUpdatingId(orderId)
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order
      )
    )

    const result = await updateOrderStatus(orderId, nextStatus)

    if (result.error) {
      toast.error(result.error)
      mutate()
    }

    setUpdatingId(null)
  }

  const handleMarkDelivered = async (orderId: string) => {
    await handleNextStatus(orderId, "delivered")
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
        drivers.find((d) => d.id === driverId)?.name || "Driver"
      toast.success(
        `${driverName} asignado a ${ids.length} orden${ids.length !== 1 ? "es" : ""}`
      )
    }

    setSelectedOrders(new Set())
    setAssignOrderIds([])
  }

  // Filter out delivered/cancelled from active view
  const activeOrders = useMemo(
    () =>
      (Array.isArray(orders) ? orders : []).filter(
        (o) => o.status !== "delivered" && o.status !== "cancelled"
      ),
    [orders]
  )

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      <div>
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Orders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage active operations in real-time
        </p>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4 snap-x">
        {COLUMNS.map((col) => {
          const colOrders = activeOrders.filter((o) =>
            col.statuses.includes(o.status)
          )
          const ColIcon = col.icon
          const isReadyCol = col.id === "ready"

          return (
            <div
              key={col.id}
              className={cn(
                "flex-shrink-0 flex flex-col gap-4 snap-center",
                isReadyCol ? "w-96" : "w-80"
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ColIcon className="h-4 w-4 text-muted-foreground" />
                  <h2
                    className="font-semibold text-foreground uppercase tracking-wide text-sm"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {col.label}
                  </h2>
                </div>
                <Badge
                  variant="outline"
                  className={cn("px-2 text-xs", col.color)}
                >
                  {colOrders.length}
                </Badge>
              </div>

              {/* Column body */}
              <ScrollArea className="flex-1 rounded-2xl bg-secondary/30 border border-border/50 p-2">
                {isReadyCol ? (
                  <ReadyColumn
                    orders={colOrders}
                    zones={zones}
                    drivers={drivers}
                    updatingId={updatingId}
                    onMarkDelivered={handleMarkDelivered}
                    onOpenAssign={handleOpenAssign}
                    selectedOrders={selectedOrders}
                    onToggleSelect={handleToggleSelect}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    {colOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full border-2 border-dashed border-border/50 rounded-xl">
                        <ColIcon className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-sm font-medium">No orders</p>
                      </div>
                    ) : (
                      colOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          nextStatus={col.nextStatus}
                          updating={updatingId === order.id}
                          onNext={
                            col.nextStatus
                              ? () =>
                                  handleNextStatus(order.id, col.nextStatus!)
                              : undefined
                          }
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
