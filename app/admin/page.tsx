"use client"

import useSWR from "swr"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import {
  Activity,
  Clock,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string; dotClassName: string }
> = {
  new: {
    label: "Nuevo",
    className: "border-primary/20 bg-primary/10 text-primary",
    dotClassName: "bg-primary",
  },
  accepted: {
    label: "Aceptado",
    className: "border-chart-2/20 bg-chart-2/10 text-chart-2",
    dotClassName: "bg-chart-2",
  },
  preparing: {
    label: "Preparando",
    className: "border-accent/20 bg-accent/10 text-accent",
    dotClassName: "bg-accent",
  },
  ready: {
    label: "Listo",
    className: "border-chart-3/20 bg-chart-3/10 text-chart-3",
    dotClassName: "bg-chart-3",
  },
  delivered: {
    label: "Entregado",
    className: "border-white/[0.08] bg-white/[0.05] text-white/60",
    dotClassName: "bg-white/35",
  },
  cancelled: {
    label: "Cancelado",
    className: "border-destructive/20 bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
  },
}

const chartConfig = {
  revenue: {
    label: "Ingresos",
    color: "var(--primary)",
  },
  orders: {
    label: "Pedidos",
    color: "rgba(255,255,255,0.34)",
  },
} satisfies ChartConfig

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

function getTodayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return { start, end }
}

function isOrderCreatedToday(order: Order) {
  const createdAt = new Date(order.createdAt)
  const { start, end } = getTodayRange()

  return createdAt >= start && createdAt < end
}

function getHourlyChartData(orders: Order[]) {
  const buckets = Array.from({ length: 24 }, (_, hour) => {
    return {
      hour,
      label: `${hour.toString().padStart(2, "0")}:00`,
      revenue: 0,
      orders: 0,
    }
  })

  orders.forEach((order) => {
    const hour = new Date(order.createdAt).getHours()
    const bucket = buckets.find((item) => item.hour === hour)

    if (bucket) {
      bucket.revenue += order.total
      bucket.orders += 1
    }
  })

  return buckets
}

function MetricCard({
  title,
  value,
  helper,
  icon: Icon,
  accent = "primary",
}: {
  title: string
  value: string
  helper: string
  icon: React.ComponentType<{ className?: string }>
  accent?: "primary" | "accent" | "muted"
}) {
  return (
    <Card className="group relative overflow-hidden rounded-[24px] border-white/[0.08] bg-[#101113] py-0 shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition-[transform,border-color,background-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-[#131417] hover:shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_34%)] opacity-70" />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-white/22 to-transparent" />
      <CardContent className="relative flex min-h-[164px] flex-col justify-between p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <p className="pt-1 text-[13px] font-semibold leading-none text-white/48">
            {title}
          </p>
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-transform duration-200 group-hover:scale-[1.03]",
              accent === "primary" &&
                "border-primary/20 bg-primary/[0.09] text-primary",
              accent === "accent" && "border-accent/20 bg-accent/[0.09] text-accent",
              accent === "muted" &&
                "border-white/[0.08] bg-white/[0.045] text-white/58"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>

        <div className="mt-8">
          <p className="text-[32px] font-bold leading-none tracking-tight text-white md:text-[34px]">
            {value}
          </p>
          <p className="mt-4 flex items-center gap-1.5 text-[12px] font-medium leading-none text-white/42">
            <TrendingUp className="h-3.5 w-3.5 text-chart-3/85" />
            {helper}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const {
    data: orders,
    isLoading,
    mutate,
  } = useSWR<Order[]>("/api/admin?type=orders", fetcher, {
    refreshInterval: 30000,
  })

  const allOrders = Array.isArray(orders) ? orders : []
  const todayOrders = allOrders.filter(isOrderCreatedToday)
  const revenue = todayOrders.reduce((sum, order) => sum + order.total, 0)
  const activeOrders = allOrders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  ).length
  const avgOrder = todayOrders.length > 0 ? revenue / todayOrders.length : 0
  const chartData = getHourlyChartData(todayOrders)
  const busiestHour = chartData.reduce(
    (top, item) => (item.orders > top.orders ? item : top),
    chartData[0]
  )
  const deliveredOrders = todayOrders.filter(
    (order) => order.status === "delivered"
  ).length

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
        <div className="flex items-start justify-between gap-6">
          <div>
            <Skeleton className="h-9 w-44 rounded-full" />
            <Skeleton className="mt-3 h-4 w-64 rounded-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Skeleton key={item} className="h-[142px] rounded-[22px]" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
          <Skeleton className="h-[360px] rounded-[24px]" />
          <Skeleton className="h-[360px] rounded-[24px]" />
        </div>
        <Skeleton className="h-[420px] rounded-[24px]" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-chart-3 shadow-[0_0_18px_rgba(34,197,94,0.65)]" />
            Local activo
          </div>
          <h1
            className="text-4xl font-bold tracking-tight text-white md:text-5xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Panel
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Resumen general de hoy, ventas y actividad reciente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/55">
            {new Date().toLocaleDateString("es-UY", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-full border-white/[0.08] bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white"
            onClick={() => mutate()}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MetricCard
          title="Ingresos"
          value={formatCurrency(revenue)}
          helper={`${todayOrders.length} órdenes hoy`}
          icon={DollarSign}
        />
        <MetricCard
          title="Pedidos totales"
          value={`${todayOrders.length}`}
          helper="Pedidos registrados hoy"
          icon={ShoppingBag}
          accent="muted"
        />
        <MetricCard
          title="Pedidos activos"
          value={`${activeOrders}`}
          helper={`${activeOrders} en progreso ahora`}
          icon={Clock}
          accent="accent"
        />
        <MetricCard
          title="Ticket promedio"
          value={formatCurrency(avgOrder)}
          helper="Ticket promedio"
          icon={Activity}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <Card className="overflow-hidden rounded-[24px] border-white/[0.08] bg-[#111214] py-0 shadow-[0_18px_54px_rgba(0,0,0,0.22)]">
          <CardHeader className="flex flex-row items-start justify-between gap-6 px-6 pb-0 pt-6">
            <div>
              <CardTitle
                className="text-xl font-bold text-white"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Ritmo de ventas
              </CardTitle>
              <p className="mt-1 text-sm text-white/45">
                Ingresos y pedidos por franja horaria.
              </p>
            </div>
            <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
              Hoy
            </Badge>
          </CardHeader>
          <CardContent className="px-3 pb-4 pt-2 sm:px-6">
            <ChartContainer
              config={chartConfig}
              className="h-[310px] w-full aspect-auto"
            >
              <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 22 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.42} />
                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  interval={1}
                />
                <YAxis hide />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      formatter={(value, name) => (
                        <div className="flex min-w-[130px] items-center justify-between gap-4">
                          <span className="text-white/50">
                            {name === "revenue" ? "Ingresos" : "Pedidos"}
                          </span>
                          <span className="font-mono font-semibold text-white">
                            {name === "revenue"
                              ? formatCurrency(Number(value))
                              : value}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-white/[0.08] bg-[#111214] py-0 shadow-[0_18px_54px_rgba(0,0,0,0.22)]">
          <CardHeader className="px-6 pb-0 pt-6">
            <CardTitle
              className="text-xl font-bold text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Flujo de pedidos
            </CardTitle>
            <p className="mt-1 text-sm text-white/45">
              Distribución rápida del día.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-6 px-6 pb-6 pt-5">
            <ChartContainer
              config={chartConfig}
              className="h-[170px] w-full aspect-auto"
            >
              <BarChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
                <XAxis dataKey="label" hide />
                <YAxis hide />
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="orders"
                  radius={[8, 8, 8, 8]}
                  fill="var(--color-orders)"
                />
              </BarChart>
            </ChartContainer>

            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <span className="text-sm text-white/50">Hora pico</span>
                <span className="text-sm font-semibold text-white">
                  {busiestHour.orders > 0 ? busiestHour.label : "Sin datos"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <span className="text-sm text-white/50">Entregados</span>
                <span className="text-sm font-semibold text-white">
                  {deliveredOrders}/{todayOrders.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <span className="text-sm text-white/50">Activos ahora</span>
                <span className="text-sm font-semibold text-primary">
                  {activeOrders}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="overflow-hidden rounded-[24px] border-white/[0.08] bg-[#111214] py-0 shadow-[0_18px_54px_rgba(0,0,0,0.22)]">
        <CardHeader className="flex flex-col gap-3 border-b border-white/[0.06] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle
              className="text-xl font-bold text-white"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Pedidos recientes
            </CardTitle>
            <p className="mt-1 text-sm text-white/45">
              Últimos pedidos recibidos por el local.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-white/[0.08] bg-white/[0.04] px-3 py-1 text-white/55">
            {todayOrders.length} hoy
          </Badge>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {todayOrders.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.025] text-center">
              <p className="text-sm font-medium text-white/70">Todavia no hay pedidos</p>
              <p className="mt-1 text-xs text-white/40">
                Los pedidos nuevos van a aparecer acá.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {todayOrders.slice(0, 10).map((order) => {
                const config = statusConfig[order.status]
                return (
                  <div
                    key={order.id}
                    className="group grid gap-4 rounded-[20px] border border-white/[0.06] bg-white/[0.035] p-4 transition-[background-color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-white/[0.055] sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        {order.orderNumber && (
                          <span className="font-mono text-xs text-white/35">
                            #{order.orderNumber}
                          </span>
                        )}
                        <p className="truncate text-sm font-semibold text-white">
                          {order.customerName}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-6 rounded-full px-2.5 text-[11px] font-semibold",
                            config.className
                          )}
                        >
                          <span
                            className={cn(
                              "mr-1.5 h-1.5 w-1.5 rounded-full",
                              config.dotClassName
                            )}
                          />
                          {config.label}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-1 text-xs leading-5 text-white/42">
                        {order.items
                          .map((item) => `${item.quantity}x ${item.name}`)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex items-end justify-between gap-4 sm:block sm:text-right">
                      <p className="text-base font-bold text-white">
                        {formatCurrency(order.total)}
                      </p>
                      <p className="mt-1 text-xs text-white/38">
                        {new Date(order.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
