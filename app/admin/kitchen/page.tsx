"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { ChefHat, Package, CheckCircle2, Volume2, VolumeX, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { updateOrderStatus } from "@/app/actions"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { playNewOrderSound, playOrderReadySound, unlockAudio } from "@/lib/sounds"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type KitchenColumn = {
    id: OrderStatus
    label: string
    color: string
    panel: string
    empty: string
    nextStatus?: OrderStatus
    buttonText: string
}

const COLUMNS: KitchenColumn[] = [
    {
        id: "new",
        label: "Nuevos",
        color: "bg-red-50 text-red-700 border-red-200",
        panel: "border-red-100 bg-red-50/20",
        empty: "border-red-100 bg-red-50/30 text-red-700/50",
        nextStatus: "accepted",
        buttonText: "Aceptar",
    },
    {
        id: "accepted",
        label: "Aceptados",
        color: "bg-amber-50 text-amber-700 border-amber-200",
        panel: "border-amber-100 bg-amber-50/20",
        empty: "border-amber-100 bg-amber-50/30 text-amber-700/50",
        nextStatus: "preparing",
        buttonText: "Preparar",
    },
    {
        id: "preparing",
        label: "En Preparación",
        color: "bg-sky-50 text-sky-700 border-sky-200",
        panel: "border-sky-100 bg-sky-50/20",
        empty: "border-sky-100 bg-sky-50/30 text-sky-700/50",
        nextStatus: "ready",
        buttonText: "Listo",
    },
    {
        id: "ready",
        label: "Listos",
        color: "bg-emerald-50 text-emerald-700 border-emerald-200",
        panel: "border-emerald-100 bg-emerald-50/20",
        empty: "border-emerald-100 bg-emerald-50/30 text-emerald-700/50",
        buttonText: "Esperando",
    },
]

function formatElapsedTime(createdAt: string): string {
    const elapsed = Date.now() - new Date(createdAt).getTime()
    const minutes = Math.floor(elapsed / 60000)
    const seconds = Math.floor((elapsed % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export default function KitchenDisplayPage() {
    const { data: initialOrders, mutate } = useSWR<Order[]>(
        "/api/admin?type=kitchen-orders",
        fetcher,
        { refreshInterval: 10000 }
    )
    const [orders, setOrders] = useState<Order[]>([])
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [fullscreen, setFullscreen] = useState(false)
    const prevStatusMapRef = useRef<Map<string, OrderStatus>>(new Map())

    useEffect(() => {
        if (!initialOrders) return

        const prev = prevStatusMapRef.current
        const isFirstLoad = prev.size === 0

        if (!isFirstLoad) {
            const newOrders = initialOrders.filter(
                (o) => !prev.has(o.id) && o.status === "new"
            )
            const justReady = initialOrders.filter(
                (o) => prev.has(o.id) && prev.get(o.id) !== "ready" && o.status === "ready"
            )

            if (soundEnabled) {
                if (newOrders.length > 0) {
                    playNewOrderSound()
                    newOrders.forEach((o) =>
                        toast.info(`Nuevo pedido #${o.orderNumber}`, { duration: 6000 })
                    )
                }
                if (justReady.length > 0) {
                    playOrderReadySound()
                    justReady.forEach((o) =>
                        toast.success(`Pedido #${o.orderNumber} listo`, { duration: 6000 })
                    )
                }
            }
        }

        prevStatusMapRef.current = new Map(initialOrders.map((o) => [o.id, o.status]))
        setOrders(initialOrders)
    }, [initialOrders, soundEnabled])

    // Realtime subscription
    useEffect(() => {
        const supabase = createClient()
        const channel = supabase
            .channel("kitchen-orders")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders" },
                () => {
                    mutate()
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [mutate])

    // Update elapsed time every second
    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [])

    const handleNextStatus = async (orderId: string, nextStatus: OrderStatus) => {
        const result = await updateOrderStatus(orderId, nextStatus)
        if (result.error) {
            toast.error(result.error)
        } else {
            mutate()
        }
    }

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen()
            setFullscreen(true)
        } else {
            document.exitFullscreen()
            setFullscreen(false)
        }
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 pb-5">
                <div>
                    <h1
                        className="text-3xl font-bold tracking-tight text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Pantalla de cocina
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Gestioná los pedidos en tiempo real
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => { unlockAudio(); setSoundEnabled(!soundEnabled) }}
                        className="h-10 w-10 rounded-full bg-card shadow-sm"
                        aria-label={soundEnabled ? "Silenciar avisos" : "Activar avisos"}
                    >
                        {soundEnabled ? (
                            <Volume2 className="h-4 w-4" />
                        ) : (
                            <VolumeX className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={toggleFullscreen}
                        className="h-10 rounded-full bg-card px-5 shadow-sm"
                    >
                        {fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                    </Button>
                </div>
            </div>

            {/* Columns */}
            <div className="flex-1 grid min-h-0 grid-cols-4 gap-4">
                {COLUMNS.map((col) => {
                    const colOrders = orders.filter((o) => o.status === col.id)

                    return (
                        <div
                            key={col.id}
                            className={cn(
                                "flex min-h-0 flex-col overflow-hidden rounded-2xl border shadow-sm",
                                col.panel
                            )}
                        >
                            {/* Column Header */}
                            <div className={cn(
                                "flex items-center justify-between border-b px-4 py-3",
                                col.color
                            )}>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-extrabold uppercase tracking-wide">
                                        {col.label}
                                    </span>
                                </div>
                                <Badge variant="outline" className={cn("min-w-7 justify-center rounded-full border-current/20 bg-white/60 px-2 text-xs font-bold", col.color)}>
                                    {colOrders.length}
                                </Badge>
                            </div>

                            {/* Orders */}
                            <ScrollArea className="flex-1 p-3">
                                <div className="space-y-3">
                                    {colOrders.length === 0 ? (
                                        <div className={cn("flex h-32 flex-col items-center justify-center rounded-xl border border-dashed", col.empty)}>
                                            <p className="text-sm font-medium">Sin pedidos</p>
                                        </div>
                                    ) : (
                                        colOrders.map((order) => (
                                            <KitchenOrderCard
                                                key={order.id}
                                                order={order}
                                                column={col}
                                                onNextStatus={handleNextStatus}
                                                now={now}
                                            />
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

interface KitchenOrderCardProps {
    order: Order
    column: KitchenColumn
    onNextStatus: (orderId: string, status: OrderStatus) => void
    now: number
}

function KitchenOrderCard({ order, column, onNextStatus, now }: KitchenOrderCardProps) {
    const elapsedTime = formatElapsedTime(order.createdAt)
    const isDelayed = Date.now() - new Date(order.createdAt).getTime() > 20 * 60000 // 20 min

    return (
        <Card className={cn(
            "overflow-hidden rounded-2xl border-border bg-card shadow-md shadow-black/5",
            isDelayed && "border-red-500/50 ring-2 ring-red-500/15"
        )}>
            <CardContent className="space-y-4 p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-black leading-none tracking-tight text-foreground">
                                #{order.orderNumber}
                            </span>
                            {isDelayed && (
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
                            )}
                        </div>
                        <p className="mt-1 text-sm font-medium capitalize text-muted-foreground">
                            {order.orderType === "pos" ? "Mostrador" : order.deliveryMethod}
                        </p>
                    </div>
                    <div className={cn(
                        "rounded-full bg-secondary px-2.5 py-1 text-right font-mono text-sm font-semibold",
                        isDelayed ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                        {elapsedTime}
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-2 border-y border-border/70 py-3">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                            <div className="flex items-baseline gap-2">
                                <span className="min-w-7 font-black text-foreground">
                                    {item.quantity}x
                                </span>
                                <span className="font-medium text-card-foreground">
                                    {item.name}
                                </span>
                            </div>
                            {item.modifiers.length > 0 && (
                                <p className="ml-9 mt-0.5 text-xs text-muted-foreground">
                                    {item.modifiers.map((m) => m.optionName).join(", ")}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Notes */}
                {order.deliveryNotes && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-xs font-medium text-amber-800">
                            📝 {order.deliveryNotes}
                        </p>
                    </div>
                )}

                {/* Action Button */}
                {column.nextStatus && (
                    <Button
                        className="h-12 w-full rounded-xl text-base font-bold shadow-sm"
                        onClick={() => onNextStatus(order.id, column.nextStatus!)}
                    >
                        {column.nextStatus === "accepted" && <CheckCircle2 className="h-4 w-4 mr-2" />}
                        {column.nextStatus === "preparing" && <ChefHat className="h-4 w-4 mr-2" />}
                        {column.nextStatus === "ready" && <Package className="h-4 w-4 mr-2" />}
                        {column.buttonText}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
