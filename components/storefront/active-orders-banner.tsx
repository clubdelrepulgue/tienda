"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChefHat, Check, Clock, PackageCheck, Truck } from "lucide-react"
import { useOrderHistoryStore } from "@/lib/store"
import type { Order, OrderStatus } from "@/lib/types"

// An order the browser still has a tracking token for AND whose live status is
// not a terminal one. This is what lets a customer — logged in or incognito —
// reopen the app after accidentally closing it and jump straight back into
// tracking, no login and no phone lookup required (the token is the credential).
type ActiveOrder = {
    token: string
    orderNumber?: number
    status: OrderStatus
}

const IN_PROGRESS: OrderStatus[] = ["new", "accepted", "preparing", "ready", "en_route"]

const STATUS_LABEL: Record<OrderStatus, string> = {
    new: "Recibido",
    accepted: "Aceptado",
    preparing: "Preparando",
    ready: "Listo para retirar",
    en_route: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
}

const STATUS_ICON: Record<OrderStatus, typeof Clock> = {
    new: Clock,
    accepted: Check,
    preparing: ChefHat,
    ready: PackageCheck,
    en_route: Truck,
    delivered: Check,
    cancelled: Clock,
}

export function ActiveOrdersBanner() {
    const orders = useOrderHistoryStore((s) => s.orders)
    const [active, setActive] = useState<ActiveOrder[]>([])
    const [mounted, setMounted] = useState(false)

    // The persisted tokens, most-recent first. Memoised so the effect below
    // only re-runs when the actual set of saved orders changes.
    const tokens = useMemo(() => orders.map((o) => o.token), [orders])
    const tokensKey = tokens.join(",")

    const refresh = useCallback(async () => {
        if (tokens.length === 0) {
            setActive([])
            return
        }

        const results = await Promise.all(
            tokens.map(async (token): Promise<ActiveOrder | null> => {
                try {
                    const res = await fetch(`/api/order/${encodeURIComponent(token)}`, {
                        cache: "no-store",
                    })
                    if (!res.ok) return null
                    const order = (await res.json()) as Order
                    if (!IN_PROGRESS.includes(order.status)) return null
                    return { token, orderNumber: order.orderNumber, status: order.status }
                } catch {
                    return null
                }
            })
        )

        setActive(results.filter((o): o is ActiveOrder => o !== null))
    }, [tokens])

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!mounted) return
        void refresh()
        // Keep the status fresh while the customer is browsing and re-sync when
        // they return to the tab (e.g. after checking the app was still open).
        const onFocus = () => void refresh()
        window.addEventListener("focus", onFocus)
        const interval = window.setInterval(() => void refresh(), 60_000)
        return () => {
            window.removeEventListener("focus", onFocus)
            window.clearInterval(interval)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mounted, tokensKey])

    if (!mounted || active.length === 0) return null

    const primary = active[0]
    const rest = active.length - 1
    const PrimaryIcon = STATUS_ICON[primary.status]

    return (
        <section className="px-4 pb-1 pt-2 sm:px-6">
            <Link
                href={`/order/${encodeURIComponent(primary.token)}`}
                className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 transition-colors hover:bg-emerald-100"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                        <PrimaryIcon className="h-4 w-4 text-emerald-700" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-emerald-950">
                            {primary.orderNumber ? `Pedido #${primary.orderNumber}` : "Tu pedido"} en curso
                            {rest > 0 && ` · +${rest} más`}
                        </p>
                        <p className="text-xs text-emerald-800">
                            {STATUS_LABEL[primary.status]} · Tocá para seguir el estado
                        </p>
                    </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Seguir pedido
                </span>
            </Link>
        </section>
    )
}
