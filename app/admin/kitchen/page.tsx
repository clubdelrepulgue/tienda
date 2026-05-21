"use client"

import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { Clock, ChefHat, Package, CheckCircle2, Volume2, VolumeX, AlertCircle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { createClient } from "@/lib/supabase/client"
import { updateOrderStatus } from "@/app/actions"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type KitchenColumn = {
    id: OrderStatus
    label: string
    color: string
    nextStatus?: OrderStatus
    buttonText: string
}

const COLUMNS: KitchenColumn[] = [
    {
        id: "new",
        label: "Nuevos",
        color: "bg-chart-1/15 text-chart-1 border-chart-1/20",
        nextStatus: "accepted",
        buttonText: "Aceptar",
    },
    {
        id: "accepted",
        label: "Aceptados",
        color: "bg-chart-2/15 text-chart-2 border-chart-2/20",
        nextStatus: "preparing",
        buttonText: "Preparar",
    },
    {
        id: "preparing",
        label: "En Preparación",
        color: "bg-accent/15 text-accent border-accent/20",
        nextStatus: "ready",
        buttonText: "Listo",
    },
    {
        id: "ready",
        label: "Listos",
        color: "bg-chart-3/15 text-chart-3 border-chart-3/20",
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
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const prevOrdersRef = useRef<Order[]>([])

    // Initialize audio
    useEffect(() => {
        audioRef.current = new Audio("/notification.mp3")
    }, [])

    useEffect(() => {
        if (initialOrders) {
            // Check for new orders
            const prevIds = new Set(prevOrdersRef.current.map((o) => o.id))
            const newOrders = initialOrders.filter((o) => !prevIds.has(o.id) && o.status === "new")

            if (newOrders.length > 0 && soundEnabled && audioRef.current) {
                audioRef.current.play().catch(() => { })
                newOrders.forEach((o) => {
                    toast.info(`Nuevo pedido #${o.orderNumber}`, {
                        duration: 5000,
                    })
                })
            }

            setOrders(initialOrders)
            prevOrdersRef.current = initialOrders
        }
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
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1
                        className="text-2xl font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Kitchen Display
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Manage orders in real-time
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="rounded-full"
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
                        className="rounded-full"
                    >
                        {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    </Button>
                </div>
            </div>

            {/* Columns */}
            <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
                {COLUMNS.map((col) => {
                    const colOrders = orders.filter((o) => o.status === col.id)

                    return (
                        <div key={col.id} className="flex flex-col min-h-0">
                            {/* Column Header */}
                            <div className={cn(
                                "flex items-center justify-between p-3 rounded-t-xl border",
                                col.color
                            )}>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm uppercase tracking-wide">
                                        {col.label}
                                    </span>
                                </div>
                                <Badge variant="outline" className={cn("text-xs", col.color)}>
                                    {colOrders.length}
                                </Badge>
                            </div>

                            {/* Orders */}
                            <ScrollArea className="flex-1 bg-secondary/30 rounded-b-xl border-x border-b border-border p-2">
                                <div className="space-y-3">
                                    {colOrders.length === 0 ? (
                                        <div className="h-32 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border/50 rounded-xl">
                                            <p className="text-sm">No orders</p>
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
            "rounded-xl border-border overflow-hidden",
            isDelayed && "border-red-500/50 ring-1 ring-red-500/20"
        )}>
            <CardContent className="p-3 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-foreground">
                                #{order.orderNumber}
                            </span>
                            {isDelayed && (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {order.orderType === "pos" ? "Mostrador" : order.deliveryMethod}
                        </p>
                    </div>
                    <div className={cn(
                        "text-right font-mono text-lg",
                        isDelayed ? "text-red-500 font-bold" : "text-muted-foreground"
                    )}>
                        {elapsedTime}
                    </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="text-sm">
                            <div className="flex items-baseline gap-2">
                                <span className="font-bold text-foreground">
                                    {item.quantity}x
                                </span>
                                <span className="text-card-foreground">
                                    {item.name}
                                </span>
                            </div>
                            {item.modifiers.length > 0 && (
                                <p className="text-xs text-muted-foreground ml-6">
                                    {item.modifiers.map((m) => m.optionName).join(", ")}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Notes */}
                {order.deliveryNotes && (
                    <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            📝 {order.deliveryNotes}
                        </p>
                    </div>
                )}

                {/* Action Button */}
                {column.nextStatus && (
                    <Button
                        className="w-full h-12 text-base font-semibold rounded-lg"
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
