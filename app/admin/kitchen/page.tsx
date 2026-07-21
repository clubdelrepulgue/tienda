"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
    AlertCircle,
    CheckCircle2,
    ChefHat,
    Clock,
    ClipboardList,
    Maximize2,
    MessageSquareText,
    PackageCheck,
    Store,
    Volume2,
    VolumeX,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase/client"
import { updateOrderStatus } from "@/app/actions"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { playNewOrderSound, playOrderReadySound, unlockAudio } from "@/lib/sounds"
import { useActiveBranch } from "../branch-context"

const MAX_VISIBLE_READY_ORDERS = 5

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type KitchenColumn = {
    id: "accepted" | "preparing" | "ready"
    label: string
    statuses: OrderStatus[]
    icon: typeof Clock
    accent: string
    headerTint: string
    badgeClassName: string
    buttonClassName?: string
    nextStatus?: OrderStatus
    buttonText?: string
}

const COLUMNS: KitchenColumn[] = [
    {
        id: "accepted",
        label: "Por preparar",
        statuses: ["accepted"],
        icon: Clock,
        accent: "bg-red-500",
        headerTint: "from-red-50",
        badgeClassName: "border-red-200 bg-red-50 text-red-700",
        buttonClassName: "bg-red-500 text-white hover:bg-red-400 active:bg-red-600",
        nextStatus: "preparing",
        buttonText: "Comenzar",
    },
    {
        id: "preparing",
        label: "En preparacion",
        statuses: ["preparing"],
        icon: ChefHat,
        accent: "bg-amber-400",
        headerTint: "from-amber-50",
        badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
        buttonClassName: "bg-amber-400 text-black hover:bg-amber-300 active:bg-amber-500",
        nextStatus: "ready",
        buttonText: "Marcar como listo",
    },
    {
        id: "ready",
        label: "Listos",
        statuses: ["ready"],
        icon: PackageCheck,
        accent: "bg-emerald-400",
        headerTint: "from-emerald-50",
        badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
]

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

function formatDateTime(value?: string): string {
    if (!value) return "-"

    return new Date(value).toLocaleString("es-UY", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function getOrderTypeLabel(order: Order): string {
    if (order.orderType === "pos") return "Mostrador"
    if (order.orderType === "phone") return "Telefono"
    if (order.deliveryMethod === "delivery") return "Delivery"
    if (order.deliveryMethod === "dine_in") return "Mesa"
    return "Retiro"
}

function sortByReadyTimeDesc(a: Order, b: Order): number {
    const bTime = new Date(b.readyAt || b.createdAt).getTime()
    const aTime = new Date(a.readyAt || a.createdAt).getTime()
    return bTime - aTime
}

export default function KitchenDisplayPage() {
    const { activeBranchId } = useActiveBranch()
    const selectedBranch = activeBranchId ?? ""
    const { data: initialOrders, mutate } = useSWR<Order[]>(
        selectedBranch ? `/api/admin?type=kitchen-orders&branchId=${selectedBranch}` : null,
        fetcher,
        { refreshInterval: 10000 }
    )
    const [orders, setOrders] = useState<Order[]>([])
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [fullscreen, setFullscreen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
    const prevOrdersRef = useRef<Order[]>([])

    useEffect(() => {
        const unlock = () => {
            unlockAudio()
            document.removeEventListener("click", unlock)
        }
        document.addEventListener("click", unlock)
        return () => document.removeEventListener("click", unlock)
    }, [])

    useEffect(() => {
        if (initialOrders) {
            const prevIds = new Set(prevOrdersRef.current.map((o) => o.id))
            const newOrders = initialOrders.filter((o) => !prevIds.has(o.id) && o.status === "accepted")

            const readyOrders = initialOrders.filter((o) => {
                const prevOrder = prevOrdersRef.current.find((po) => po.id === o.id)
                return o.status === "ready" && prevOrder && prevOrder.status !== "ready"
            })

            if (newOrders.length > 0 && soundEnabled) {
                playNewOrderSound()
                newOrders.forEach((o) => {
                    toast.info(`Nuevo pedido #${o.orderNumber}`, {
                        duration: 5000,
                    })
                })
            }

            if (readyOrders.length > 0 && soundEnabled) {
                playOrderReadySound()
                readyOrders.forEach((o) => {
                    toast.success(`Pedido #${o.orderNumber} listo`, {
                        duration: 5000,
                    })
                })
            }

            setOrders(initialOrders)
            prevOrdersRef.current = initialOrders
        }
    }, [initialOrders, soundEnabled])

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

    const [now, setNow] = useState(Date.now())
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [])

    const readyHistory = useMemo(
        () => orders.filter((order) => order.status === "ready").sort(sortByReadyTimeDesc),
        [orders]
    )

    const readyPreviewIds = useMemo(
        () => new Set(readyHistory.slice(0, MAX_VISIBLE_READY_ORDERS).map((order) => order.id)),
        [readyHistory]
    )

    const handleNextStatus = async (orderId: string, nextStatus: OrderStatus) => {
        const previousOrders = orders
        const changedAt = new Date().toISOString()

        setUpdatingIds((current) => {
            const next = new Set(current)
            next.add(orderId)
            return next
        })

        setOrders((current) =>
            current.map((order) =>
                order.id === orderId
                    ? {
                        ...order,
                        status: nextStatus,
                        preparingAt: nextStatus === "preparing" ? changedAt : order.preparingAt,
                        readyAt: nextStatus === "ready" ? changedAt : order.readyAt,
                    }
                    : order
            )
        )

        try {
            const result = await updateOrderStatus(orderId, nextStatus)

            if (result.error) {
                toast.error(result.error)
                setOrders(previousOrders)
                return
            }

            await mutate()
        } catch (error) {
            toast.error("No se pudo actualizar el pedido")
            setOrders(previousOrders)
        } finally {
            setUpdatingIds((current) => {
                const next = new Set(current)
                next.delete(orderId)
                return next
            })
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
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1
                        className="text-2xl font-bold text-foreground"
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        Pantalla de cocina
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Pedidos activos en tiempo real
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="h-10 w-10 rounded-full border-border bg-card shadow-sm hover:bg-muted"
                        aria-label={soundEnabled ? "Silenciar sonidos" : "Activar sonidos"}
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
                        className="h-10 rounded-full border-border bg-card px-4 shadow-sm hover:bg-muted"
                    >
                        <Maximize2 className="h-4 w-4" />
                        {fullscreen ? "Salir" : "Pantalla completa"}
                    </Button>
                </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 lg:grid-cols-3 lg:overflow-hidden">
                {COLUMNS.map((col) => {
                    const colOrders = orders
                        .filter((order) => col.statuses.includes(order.status))
                        .filter((order) => col.id !== "ready" || readyPreviewIds.has(order.id))
                    const Icon = col.icon

                    return (
                        <section
                            key={col.id}
                            className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:min-h-0"
                        >
                            <div className={cn("border-b border-border bg-gradient-to-b to-card p-4", col.headerTint)}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className={cn("h-2.5 w-2.5 rounded-full", col.accent)} />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-4 w-4 text-muted-foreground" />
                                                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                                                    {col.label}
                                                </h2>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs font-bold", col.badgeClassName)}>
                                        {col.id === "ready" ? readyHistory.length : colOrders.length}
                                    </Badge>
                                </div>
                                {col.id === "ready" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setHistoryOpen(true)}
                                        className="mt-3 h-9 w-full rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                                    >
                                        <ClipboardList className="h-4 w-4" />
                                        Ver historial
                                    </Button>
                                )}
                            </div>

                            <ScrollArea className="min-h-0 flex-1 p-3">
                                <div className="space-y-3">
                                    {colOrders.length === 0 ? (
                                        <EmptyColumnState />
                                    ) : (
                                        colOrders.map((order) => (
                                            <KitchenOrderCard
                                                key={order.id}
                                                order={order}
                                                column={col}
                                                onNextStatus={handleNextStatus}
                                                now={now}
                                                updating={updatingIds.has(order.id)}
                                            />
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </section>
                    )
                })}
            </div>

            <ReadyHistoryDialog
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                orders={readyHistory}
                now={now}
            />
        </div>
    )
}

function EmptyColumnState() {
    return (
        <div className="flex min-h-[132px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/35 p-6 text-center">
            <PackageCheck className="mb-2 h-5 w-5 text-muted-foreground/60" />
            <p className="text-sm font-semibold text-muted-foreground">Sin pedidos por ahora</p>
        </div>
    )
}

interface KitchenOrderCardProps {
    order: Order
    column: KitchenColumn
    onNextStatus: (orderId: string, status: OrderStatus) => void
    now: number
    updating: boolean
}

function KitchenOrderCard({ order, column, onNextStatus, now, updating }: KitchenOrderCardProps) {
    const isReady = order.status === "ready"
    const elapsedTime = formatElapsedTime(order.createdAt, now, isReady ? order.readyAt : undefined)
    const isDelayed = !isReady && getElapsedMs(order.createdAt, now) > 20 * 60000

    return (
        <Card className={cn(
            "overflow-hidden rounded-2xl border-border bg-card py-0 shadow-sm transition-[opacity,transform,border-color,background-color,box-shadow] duration-200 hover:border-primary/25 hover:bg-background hover:shadow-md",
            updating && "pointer-events-none scale-[0.98] opacity-60",
            isDelayed && "border-red-300 ring-1 ring-red-200"
        )}>
            <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-3xl font-black leading-none text-foreground">
                                #{order.orderNumber}
                            </span>
                            {isDelayed && (
                                <AlertCircle className="h-5 w-5 shrink-0 text-red-300" />
                            )}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <Store className="h-4 w-4" />
                            <span>{getOrderTypeLabel(order)}</span>
                        </div>
                    </div>
                    <div className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-lg font-black leading-none",
                        isDelayed
                            ? "border-red-200 bg-red-50 text-red-700"
                            : isReady
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-border bg-muted text-foreground"
                    )}
                        style={{ fontFamily: "var(--font-heading)" }}
                    >
                        <Clock className="h-4 w-4" />
                        <span>{elapsedTime}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="rounded-xl border border-border/70 bg-muted/45 p-3">
                            <div className="flex items-baseline gap-2 text-[15px] leading-snug">
                                <span className="font-black text-foreground">{item.quantity}x</span>
                                <span className="font-semibold text-foreground/85">
                                    {item.name}
                                    {item.variantName && (
                                        <span className="font-bold text-primary"> · {item.variantName}</span>
                                    )}
                                </span>
                            </div>
                            {item.modifiers.length > 0 && (
                                <p className="mt-1.5 pl-6 text-sm leading-relaxed text-muted-foreground">
                                    {item.modifiers.map((m) => m.optionName).join(", ")}
                                </p>
                            )}
                            {item.note && (
                                <p className="mt-1.5 pl-6 text-sm font-semibold italic leading-relaxed text-amber-700">
                                    ✎ {item.note}
                                </p>
                            )}
                        </div>
                    ))}
                </div>

                {order.deliveryNotes && (
                    <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                        <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{order.deliveryNotes}</p>
                    </div>
                )}

                {column.nextStatus ? (
                    <Button
                        className={cn("h-12 w-full rounded-xl text-base font-black shadow-none", column.buttonClassName)}
                        disabled={updating}
                        onClick={() => onNextStatus(order.id, column.nextStatus!)}
                    >
                        {updating ? (
                            "Actualizando..."
                        ) : (
                            <>
                                {column.nextStatus === "preparing" && <ChefHat className="h-4 w-4" />}
                                {column.nextStatus === "ready" && <PackageCheck className="h-4 w-4" />}
                                {column.buttonText}
                            </>
                        )}
                    </Button>
                ) : (
                    <Badge className="h-10 w-full justify-center rounded-xl border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle2 className="h-4 w-4" />
                        Listo
                    </Badge>
                )}
            </CardContent>
        </Card>
    )
}

function ReadyHistoryDialog({
    open,
    onOpenChange,
    orders,
    now,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    orders: Order[]
    now: number
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[86vh] overflow-hidden rounded-2xl border-border bg-card p-0 text-foreground shadow-xl sm:max-w-4xl">
                <DialogHeader className="border-b border-border px-5 py-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ClipboardList className="h-5 w-5 text-emerald-600" />
                        Historial de listos
                    </DialogTitle>
                    <DialogDescription>
                        Pedidos terminados ordenados del mas reciente al mas antiguo.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[68vh] px-5 py-4">
                    {orders.length === 0 ? (
                        <EmptyColumnState />
                    ) : (
                        <div className="space-y-3">
                            {orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="rounded-2xl border border-border bg-background p-4"
                                >
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-2xl font-black">#{order.orderNumber}</span>
                                                <Badge variant="outline" className="rounded-full border-border bg-muted text-muted-foreground">
                                                    {getOrderTypeLabel(order)}
                                                </Badge>
                                                <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {formatElapsedTime(order.createdAt, now, order.readyAt)}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                                                <span>Creado: {formatDateTime(order.createdAt)}</span>
                                                <span>Listo: {formatDateTime(order.readyAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-1.5">
                                        {order.items.map((item, idx) => (
                                            <div key={idx} className="text-[15px] leading-relaxed text-foreground/85">
                                                <span className="font-black text-foreground">{item.quantity}x</span>{" "}
                                                {item.name}
                                                {item.variantName && (
                                                    <span className="font-semibold text-primary"> · {item.variantName}</span>
                                                )}
                                                {item.modifiers.length > 0 && (
                                                    <span className="text-sm text-muted-foreground">
                                                        {" "}({item.modifiers.map((m) => m.optionName).join(", ")})
                                                    </span>
                                                )}
                                                {item.note && (
                                                    <span className="text-sm italic text-amber-700">
                                                        {" "}— ✎ {item.note}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {order.deliveryNotes && (
                                        <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                                            <MessageSquareText className="h-4 w-4 shrink-0" />
                                            <span>{order.deliveryNotes}</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
