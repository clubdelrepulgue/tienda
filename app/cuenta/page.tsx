"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
    ArrowLeft,
    Check,
    ChevronRight,
    Gift,
    Loader2,
    LogOut,
    Package,
    Phone,
    Store,
    Truck,
    UserRound,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { useCustomerStore } from "@/lib/store"
import { getAccountData, linkCustomerAccount, type AccountData } from "@/app/account-actions"
import { signInWithGoogle } from "@/components/account/login-button"
import { cn, formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import type { User } from "@supabase/supabase-js"

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
    new: { label: "Recibido", className: "bg-blue-100 text-blue-800" },
    accepted: { label: "Aceptado", className: "bg-indigo-100 text-indigo-800" },
    preparing: { label: "Preparando", className: "bg-amber-100 text-amber-800" },
    ready: { label: "Listo", className: "bg-teal-100 text-teal-800" },
    en_route: { label: "En camino", className: "bg-purple-100 text-purple-800" },
    delivered: { label: "Entregado", className: "bg-emerald-100 text-emerald-800" },
    cancelled: { label: "Cancelado", className: "bg-red-100 text-red-700" },
}

function formatOrderDate(value: string) {
    return new Date(value).toLocaleDateString("es-UY", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export default function AccountPage() {
    const supabase = useMemo(() => createClient(), [])
    const router = useRouter()
    const localPhone = useCustomerStore((s) => s.phone)
    const [user, setUser] = useState<User | null>(null)
    const [authChecked, setAuthChecked] = useState(false)
    const [data, setData] = useState<AccountData | null>(null)
    const [loadingData, setLoadingData] = useState(false)
    const [phoneInput, setPhoneInput] = useState("")
    const [linking, setLinking] = useState(false)

    const loadAccount = useCallback(async () => {
        setLoadingData(true)
        try {
            const result = await getAccountData()
            if ("error" in result) {
                toast.error(result.error)
                return
            }
            setData(result)
        } finally {
            setLoadingData(false)
        }
    }, [])

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
            setAuthChecked(true)
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => subscription.unsubscribe()
    }, [supabase])

    // On first load, try to link automatically with the phone this browser
    // already used at checkout — most customers never see the phone prompt.
    useEffect(() => {
        if (!user) return

        const run = async () => {
            const linkResult = await linkCustomerAccount(localPhone || undefined)
            if ("error" in linkResult && linkResult.error) {
                toast.error(linkResult.error)
            }
            await loadAccount()
        }

        run()
    }, [user, localPhone, loadAccount])

    const handleLinkPhone = async () => {
        if (!phoneInput.trim()) return
        setLinking(true)
        try {
            const result = await linkCustomerAccount(phoneInput)
            if ("error" in result && result.error) {
                toast.error(result.error)
                return
            }
            toast.success("Teléfono vinculado a tu cuenta")
            await loadAccount()
        } finally {
            setLinking(false)
        }
    }

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        setData(null)
        toast.success("Sesión cerrada")
        router.push("/")
    }

    if (!authChecked) {
        return (
            <div className="flex min-h-dvh items-center justify-center bg-secondary">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-secondary p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <UserRound className="h-8 w-8 text-primary" />
                </div>
                <div className="max-w-sm">
                    <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        Tu cuenta
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Iniciá sesión con Google para ver tu historial de pedidos, tus datos guardados
                        y tu progreso en el club de fidelidad. Igual podés pedir sin cuenta.
                    </p>
                </div>
                <Button
                    onClick={() => signInWithGoogle("/cuenta")}
                    className="rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
                >
                    Continuar con Google
                </Button>
                <Button asChild variant="ghost" className="rounded-full text-muted-foreground">
                    <Link href="/">Volver al inicio</Link>
                </Button>
            </div>
        )
    }

    const loyalty = data?.loyalty ?? null

    return (
        <div className="flex min-h-dvh flex-col bg-secondary">
            <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
                <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                    <Button variant="ghost" size="icon" className="rounded-full hover:bg-secondary" asChild>
                        <Link href="/" aria-label="Volver al inicio">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
                        Mi cuenta
                    </h1>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto gap-1.5 rounded-full text-muted-foreground hover:text-destructive"
                        onClick={handleSignOut}
                    >
                        <LogOut className="h-4 w-4" />
                        Salir
                    </Button>
                </div>
            </header>

            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
                {/* Profile */}
                <Card className="rounded-2xl border-border bg-card">
                    <CardContent className="flex items-center gap-4 p-5">
                        {data?.profile.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={data.profile.avatarUrl}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="h-12 w-12 rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                <UserRound className="h-6 w-6 text-primary" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">
                                {data?.customer?.name || data?.profile.name || "Cliente"}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">{data?.profile.email}</p>
                            {data?.customer?.phone && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" /> {data.customer.phone}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Phone link prompt */}
                {data?.needsPhone && (
                    <Card className="rounded-2xl border-primary/25 bg-primary/5">
                        <CardContent className="flex flex-col gap-3 p-5">
                            <p className="text-sm font-semibold text-foreground">
                                Vinculá tu teléfono
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Tus pedidos y tus puntos de fidelidad están asociados a tu número.
                                Ingresalo para recuperarlos.
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    type="tel"
                                    placeholder="099 123 456"
                                    value={phoneInput}
                                    onChange={(e) => setPhoneInput(e.target.value)}
                                    className="rounded-xl border-0 bg-white"
                                />
                                <Button
                                    onClick={handleLinkPhone}
                                    disabled={linking || !phoneInput.trim()}
                                    className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {linking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Loyalty */}
                {loyalty && (
                    <Card className="rounded-2xl border-primary/25 bg-primary/5">
                        <CardContent className="p-5">
                            <div className="mb-3 flex items-center gap-2">
                                <Gift className="h-4 w-4 text-primary" />
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-card-foreground">
                                    Club de fidelidad
                                </h2>
                                <span className="ml-auto text-xs text-muted-foreground">
                                    {loyalty.ordersCount} pedido{loyalty.ordersCount === 1 ? "" : "s"} en total
                                </span>
                            </div>
                            {loyalty.rewardCouponCode ? (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm text-foreground">
                                        🎉 ¡Tenés un cupón de descuento esperándote!
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(loyalty.rewardCouponCode!)
                                            toast.success("Código copiado")
                                        }}
                                        className="w-fit rounded-lg border border-dashed border-primary/50 bg-white px-4 py-2 font-mono text-base font-bold tracking-wider text-primary"
                                    >
                                        {loyalty.rewardCouponCode}
                                    </button>
                                    <p className="text-xs text-muted-foreground">
                                        Tocá el código para copiarlo. Se aplica en el checkout.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center gap-1.5">
                                        {Array.from({ length: loyalty.target }).map((_, i) => (
                                            <span
                                                key={i}
                                                className={cn(
                                                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                                                    i < loyalty.progress
                                                        ? "bg-primary text-primary-foreground"
                                                        : "border border-dashed border-primary/40 text-primary/50"
                                                )}
                                            >
                                                {i < loyalty.progress ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                            </span>
                                        ))}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        {loyalty.target - loyalty.progress === 1
                                            ? "¡Te falta 1 pedido para tu próximo cupón de descuento!"
                                            : `Te faltan ${loyalty.target - loyalty.progress} pedidos para tu próximo cupón de descuento.`}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Order history */}
                <Card className="rounded-2xl border-border bg-card">
                    <CardContent className="p-5">
                        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-card-foreground">
                            Mis pedidos
                        </h2>
                        {loadingData ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                        ) : !data || data.orders.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-8 text-center">
                                <Package className="h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                    Todavía no hay pedidos asociados a tu cuenta.
                                </p>
                                <Button asChild size="sm" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                                    <Link href="/">Hacer mi primer pedido</Link>
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col divide-y divide-border">
                                {data.orders.map((order) => {
                                    const status = STATUS_LABELS[order.status] || {
                                        label: order.status,
                                        className: "bg-secondary text-muted-foreground",
                                    }

                                    return (
                                        <Link
                                            key={order.id}
                                            href={`/order/${order.trackingToken}`}
                                            className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                                                {order.fulfillmentType === "delivery" ? (
                                                    <Truck className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Store className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {order.orderNumber ? `#${order.orderNumber}` : "Pedido"}
                                                    </p>
                                                    <Badge className={cn("rounded-full border-0 text-[11px]", status.className)}>
                                                        {status.label}
                                                    </Badge>
                                                </div>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {formatOrderDate(order.createdAt)}
                                                    {order.branchName && ` · ${order.branchName}`}
                                                    {order.itemCount > 0 &&
                                                        ` · ${order.itemCount} producto${order.itemCount > 1 ? "s" : ""}`}
                                                </p>
                                            </div>
                                            <span className="text-sm font-bold text-foreground">
                                                {formatPrice(order.total)}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition group-hover:translate-x-0.5" />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
