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
  User,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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

// ─── Order Card ────────────────────────────────────────────────

function OrderCard({
  order,
  nextStatus,
  now,
  updating,
  onNext,
  showAssign,
  driver,
  deliveryDrivers = [],
  onDeliveryDepart,
  departing = false,
}: {
  order: Order
  nextStatus?: OrderStatus
  now: number
  updating: boolean
  onNext?: () => void
  showAssign?: boolean
  driver?: Driver | null
  deliveryDrivers?: Driver[]
  onDeliveryDepart?: (orderId: string, driverId: string) => void
  departing?: boolean
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
      className={cn(
        "group w-full min-w-0 overflow-hidden rounded-[22px] border-white/[0.075] bg-[#15161a] py-0 shadow-[0_14px_38px_rgba(0,0,0,0.2)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-[#18191d] hover:shadow-[0_18px_48px_rgba(0,0,0,0.28)]",
        updating && "opacity-50 pointer-events-none",
        departing && "scale-[0.98] opacity-0 blur-[1px]",
      )}
    >
      <CardHeader className="p-3.5 pb-2">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <span
              className="block text-3xl font-black leading-none text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              #{order.orderNumber}
            </span>
          </div>
          <div
            className={cn(
              "flex max-w-[112px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-base font-black leading-none",
              isReady
                ? "border-emerald-300/25 bg-emerald-400/12 text-emerald-100"
                : "border-white/[0.08] bg-white/[0.045] text-white/86"
            )}
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <Clock className="h-4 w-4" />
            <span>{elapsedTime}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3.5 pt-0">
        <div className="mb-2 flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-sm font-medium text-white/56">
          <User className="h-3.5 w-3.5 shrink-0 text-white/42" />
          <span className="min-w-0 truncate font-bold text-white/88">{order.customerName}</span>
          {order.customerPhone && (
            <>
              <span className="shrink-0 text-white/28">·</span>
              <Phone className="h-3.5 w-3.5 shrink-0 text-white/38" />
              <span className="max-w-[90px] shrink truncate text-white/58">{order.customerPhone}</span>
            </>
          )}
          {order.deliveryMethod === "delivery" && order.address && (
            <>
              <span className="shrink-0 text-white/28">·</span>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-white/38" />
              <span className="min-w-0 truncate text-white/58">{order.address}</span>
            </>
          )}
        </div>

        <div className="mb-2 min-w-0 space-y-1 overflow-hidden rounded-2xl bg-black/10 p-2.5">
          {order.items.map((item) => (
            <div key={item.id} className="flex min-w-0 justify-between text-sm leading-snug">
              <div className="min-w-0 max-w-full overflow-hidden">
                <span className="font-bold text-white">
                  {item.quantity}x
                </span>{" "}
                <span className="font-semibold text-white/78">{item.name}</span>
                {item.modifiers?.length > 0 && (
                  <p className="ml-5 mt-0.5 line-clamp-2 max-w-[calc(100%-1.25rem)] break-words text-xs leading-snug text-white/42">
                    {item.modifiers.map((m) => m.optionName).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {isDeliveryDispatch && (
          <div className="mb-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-2.5">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/45">
              <Bike className="h-3.5 w-3.5" />
              Delivery
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
                disabled={updating || activeDrivers.length === 0}
              >
                <SelectTrigger className="h-9 w-full rounded-full border-white/[0.08] bg-black/15 text-white/75 hover:bg-black/25">
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
              <p className="mt-2 text-xs text-white/40">
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

        <div className="mt-auto flex min-w-0 max-w-full flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
          <div className="min-w-0 flex-1 basis-[132px]">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white/42">
              <FulfillmentIcon className="h-3 w-3" />
              <span className="uppercase tracking-[0.14em]">{fulfillmentLabel}</span>
            </div>
            <span className="mt-0.5 text-base font-extrabold leading-none text-white">
              {formatPrice(order.total)}
            </span>
          </div>

          {onNext && nextStatus && (
            <Button
              size="sm"
              className="ml-auto h-9 max-w-full shrink-0 rounded-full bg-primary px-3 text-sm font-bold text-primary-foreground shadow-[0_10px_24px_rgba(255,56,56,0.24)] hover:bg-primary/90 active:scale-95 max-[420px]:basis-full"
              onClick={onNext}
            >
              <span className="truncate">Siguiente</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}

          {showAssign && !isDeliveryDispatch && !nextStatus && !driver && (
            <Badge
              variant="outline"
              className="rounded-full border-dashed border-white/[0.1] bg-white/[0.035] text-xs text-white/45"
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
  onDeliveryDepart,
  departingOrderIds,
}: {
  orders: Order[]
  zones: DeliveryZone[]
  drivers: Driver[]
  now: number
  updatingId: string | null
  onMarkDelivered: (orderId: string) => void
  onDeliveryDepart: (orderId: string, driverId: string) => void
  departingOrderIds: Set<string>
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

  if (orders.length === 0) {
    return (
      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.11] bg-black/10 p-6 text-center text-white/58">
        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
          <Package className="h-5 w-5 opacity-60" />
        </div>
        <p className="text-sm font-semibold">Sin pedidos</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 overflow-hidden">
      {/* ── Delivery orders grouped by zone ── */}
      {deliveryOrders.length > 0 && (
        <div className="min-w-0 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <Truck className="h-3.5 w-3.5 text-white/45" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/52">
              Delivery
            </span>
            <Badge variant="outline" className="ml-auto rounded-full border-white/[0.08] bg-white/[0.035] text-xs text-white/60">
              {deliveryOrders.length}
            </Badge>
          </div>

          {Array.from(ordersByZone.entries()).map(([zoneId, zoneOrders]) => {
            const zone = zoneMap.get(zoneId)
            return (
              <div key={zoneId} className="min-w-0 space-y-2 overflow-hidden">
                {/* Zone header */}
                <div
                  className="flex items-center gap-2 rounded-2xl border border-white/[0.06] px-3 py-2"
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
                  <span className="flex-1 text-xs font-bold text-white/78">
                    {zone?.name || "Sin zona"}
                  </span>
                  <span className="text-xs text-white/45">
                    {zoneOrders.length} orden{zoneOrders.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Orders in this zone */}
                {zoneOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={now}
                    updating={updatingId === order.id}
                    departing={departingOrderIds.has(order.id)}
                    driver={
                      order.driverId
                        ? driverMap.get(order.driverId) || null
                        : null
                    }
                    deliveryDrivers={drivers}
                    onDeliveryDepart={onDeliveryDepart}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pickup / Dine-in orders ── */}
      {pickupOrders.length > 0 && (
        <div className="min-w-0 space-y-3 overflow-hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
            <Store className="h-3.5 w-3.5 text-white/45" />
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/52">
              Retiro / En local
            </span>
            <Badge variant="outline" className="ml-auto rounded-full border-white/[0.08] bg-white/[0.035] text-xs text-white/60">
              {pickupOrders.length}
            </Badge>
          </div>

          {pickupOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              updating={updatingId === order.id}
              departing={departingOrderIds.has(order.id)}
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
}

const COLUMNS: Column[] = [
  {
    id: "pending",
    label: "Pendientes",
    icon: Clock,
    color: "border-orange-300/25 bg-orange-500/15 text-orange-100",
    headerTint: "from-orange-500/[0.13]",
    iconClassName: "border-orange-300/20 bg-orange-500/12 text-orange-100",
    statuses: ["new", "accepted"],
    nextStatus: "preparing",
  },
  {
    id: "preparing",
    label: "Preparando",
    icon: ChefHat,
    color: "border-amber-300/25 bg-amber-400/15 text-amber-100",
    headerTint: "from-amber-400/[0.13]",
    iconClassName: "border-amber-300/20 bg-amber-400/12 text-amber-100",
    statuses: ["preparing"],
    nextStatus: "ready",
  },
  {
    id: "ready",
    label: "Listos",
    icon: Package,
    color: "border-emerald-300/25 bg-emerald-400/15 text-emerald-100",
    headerTint: "from-emerald-400/[0.13]",
    iconClassName: "border-emerald-300/20 bg-emerald-400/12 text-emerald-100",
    statuses: ["ready"],
  },
]

export default function OrdersPage() {
  const { data: session } = useSWR<{ branches: Branch[]; activeBranchId: string | null }>(
    "/api/admin?type=session",
    fetcher
  )
  const [selectedBranch, setSelectedBranch] = useState("")
  const { data: dispatchData, mutate } = useSWR<{
    orders: Order[]
    zones: DeliveryZone[]
    drivers: Driver[]
  }>(selectedBranch ? `/api/admin?type=dispatch&branchId=${selectedBranch}` : null, fetcher)

  const [orders, setOrders] = useState<Order[]>([])
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [departingOrderIds, setDepartingOrderIds] = useState<Set<string>>(new Set())
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [assignOrderIds, setAssignOrderIds] = useState<string[]>([])
  const [now, setNow] = useState(Date.now())

  // Audio ref for notification
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!selectedBranch && session?.activeBranchId) {
      setSelectedBranch(session.activeBranchId)
    }
  }, [selectedBranch, session?.activeBranchId])

  useEffect(() => {
    audioRef.current = new Audio("/notification.mp3")
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
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
            toast.info("Nuevo pedido recibido")
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
    const changedAt = new Date().toISOString()

    setUpdatingId(orderId)
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: nextStatus,
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
    }

    setUpdatingId(null)
  }

  const handleMarkDelivered = async (orderId: string) => {
    await handleNextStatus(orderId, "delivered")
  }

  const handleDeliveryDepart = async (orderId: string, driverId: string) => {
    setUpdatingId(orderId)
    setDepartingOrderIds((current) => {
      const next = new Set(current)
      next.add(orderId)
      return next
    })

    await new Promise((resolve) => setTimeout(resolve, 320))

    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, driverId } : order
      )
    )

    const result = await assignDriver(orderId, driverId)

    if (result.error) {
      toast.error(result.error)
      setDepartingOrderIds((current) => {
        const next = new Set(current)
        next.delete(orderId)
        return next
      })
      mutate()
    } else {
      const driverName =
        drivers.find((driver) => driver.id === driverId)?.name || "Repartidor"
      toast.success(`Salio! ${driverName} se llevo el pedido`)
    }

    setDepartingOrderIds((current) => {
      const next = new Set(current)
      next.delete(orderId)
      return next
    })
    setUpdatingId(null)
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
        drivers.find((d) => d.id === driverId)?.name || "Repartidor"
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
        (o) =>
          o.status !== "delivered" &&
          o.status !== "cancelled" &&
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
        <Select value={selectedBranch} onValueChange={setSelectedBranch}>
          <SelectTrigger className="h-11 w-full rounded-full border-border bg-card px-4 shadow-sm sm:w-56">
            <SelectValue placeholder="Sucursal" />
          </SelectTrigger>
          <SelectContent>
            {(session?.branches || []).map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              className="flex h-[calc(100dvh-14rem)] min-h-[420px] min-w-[280px] max-h-[680px] max-w-full snap-center flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111216] shadow-[0_14px_40px_rgba(0,0,0,0.16)]"
            >
              {/* Column header */}
              <div
                className={cn(
                  "border-b border-white/[0.07] bg-gradient-to-b to-transparent px-4 py-3.5",
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
                      className="truncate text-sm font-bold uppercase tracking-[0.1em] text-white/90"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {col.label}
                    </h2>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-7 rounded-full px-2.5 text-xs font-bold tabular-nums",
                      col.color
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
                    onDeliveryDepart={handleDeliveryDepart}
                    departingOrderIds={departingOrderIds}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
                    {colOrders.length === 0 ? (
                      <div className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.11] bg-black/10 p-6 text-center text-white/58">
                        <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]">
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
                          now={now}
                          updating={updatingId === order.id}
                          departing={departingOrderIds.has(order.id)}
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
