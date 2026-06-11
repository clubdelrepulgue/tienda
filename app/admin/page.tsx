"use client"

import { useState } from "react"
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
  CalendarDays,
  Clock,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { Order, OrderStatus } from "@/lib/types"
import { cn, formatPrice } from "@/lib/utils"

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
  return formatPrice(value)
}

type PeriodOption =
  | "today"
  | "yesterday"
  | "this-week"
  | "last-week"
  | "last-7-days"
  | "last-30-days"
  | "this-month"
  | "last-month"
  | "this-year"
  | "custom"

type CustomPeriodMode = "date" | "range" | "week" | "month" | "year"

type DateRange = {
  startDate: Date
  endDate: Date
  label: string
}

type ChartBucket = {
  label: string
  revenue: number
  orders: number
}

const periodOptions: { value: PeriodOption; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "yesterday", label: "Ayer" },
  { value: "this-week", label: "Esta semana" },
  { value: "last-week", label: "Semana pasada" },
  { value: "last-7-days", label: "Ultimos 7 dias" },
  { value: "last-30-days", label: "Ultimos 30 dias" },
  { value: "this-month", label: "Este mes" },
  { value: "last-month", label: "Mes pasado" },
  { value: "this-year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
]

function toInputDate(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

function startOfDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(value: Date, days: number) {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

function addMonths(value: Date, months: number) {
  const date = new Date(value)
  date.setMonth(date.getMonth() + months)
  return date
}

function addYears(value: Date, years: number) {
  const date = new Date(value)
  date.setFullYear(date.getFullYear() + years)
  return date
}

function startOfWeek(value: Date) {
  const date = startOfDay(value)
  const day = date.getDay()
  const offset = day === 0 ? -6 : 1 - day
  return addDays(date, offset)
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function startOfYear(value: Date) {
  return new Date(value.getFullYear(), 0, 1)
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number)

  if (!year || !month || !day) return startOfDay(new Date())

  return new Date(year, month - 1, day)
}

function parseMonthInput(value: string) {
  const [year, month] = value.split("-").map(Number)

  if (!year || !month) return startOfMonth(new Date())

  return new Date(year, month - 1, 1)
}

function parseWeekInput(value: string) {
  const match = value.match(/^(\d{4})-W(\d{2})$/)
  if (!match) return startOfWeek(new Date())

  const year = Number(match[1])
  const week = Number(match[2])
  const fourthOfJanuary = new Date(year, 0, 4)
  const firstWeekStart = startOfWeek(fourthOfJanuary)

  return addDays(firstWeekStart, (week - 1) * 7)
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("es-UY", {
    day: "numeric",
    month: "short",
  })
}

function formatMonthYear(value: Date) {
  return value.toLocaleDateString("es-UY", {
    month: "long",
    year: "numeric",
  })
}

function formatRangeLabel(startDate: Date, endDate: Date) {
  const inclusiveEnd = addDays(endDate, -1)

  if (toInputDate(startDate) === toInputDate(inclusiveEnd)) {
    return formatShortDate(startDate)
  }

  return `${formatShortDate(startDate)} - ${formatShortDate(inclusiveEnd)}`
}

function getDateRangeFromPeriod(
  period: PeriodOption,
  custom: {
    mode: CustomPeriodMode
    date: string
    from: string
    to: string
    week: string
    month: string
    year: string
  }
): DateRange {
  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)

  if (period === "today") {
    return { startDate: today, endDate: tomorrow, label: "Hoy" }
  }

  if (period === "yesterday") {
    const yesterday = addDays(today, -1)
    return { startDate: yesterday, endDate: today, label: "Ayer" }
  }

  if (period === "this-week") {
    const startDate = startOfWeek(today)
    return { startDate, endDate: tomorrow, label: "Esta semana" }
  }

  if (period === "last-week") {
    const thisWeek = startOfWeek(today)
    const startDate = addDays(thisWeek, -7)
    return { startDate, endDate: thisWeek, label: "Semana pasada" }
  }

  if (period === "last-7-days") {
    const startDate = addDays(today, -6)
    return { startDate, endDate: tomorrow, label: "Ultimos 7 dias" }
  }

  if (period === "last-30-days") {
    const startDate = addDays(today, -29)
    return { startDate, endDate: tomorrow, label: "Ultimos 30 dias" }
  }

  if (period === "this-month") {
    const startDate = startOfMonth(today)
    return { startDate, endDate: tomorrow, label: "Este mes" }
  }

  if (period === "last-month") {
    const thisMonth = startOfMonth(today)
    const startDate = addMonths(thisMonth, -1)
    return { startDate, endDate: thisMonth, label: formatMonthYear(startDate) }
  }

  if (period === "this-year") {
    const startDate = startOfYear(today)
    return { startDate, endDate: tomorrow, label: `${today.getFullYear()}` }
  }

  if (custom.mode === "range") {
    const startDate = parseDateInput(custom.from)
    const rawEnd = parseDateInput(custom.to)
    const endDate = addDays(rawEnd < startDate ? startDate : rawEnd, 1)

    return { startDate, endDate, label: formatRangeLabel(startDate, endDate) }
  }

  if (custom.mode === "week") {
    const startDate = parseWeekInput(custom.week)
    const endDate = addDays(startDate, 7)

    return { startDate, endDate, label: formatRangeLabel(startDate, endDate) }
  }

  if (custom.mode === "month") {
    const startDate = parseMonthInput(custom.month)
    const endDate = addMonths(startDate, 1)

    return { startDate, endDate, label: formatMonthYear(startDate) }
  }

  if (custom.mode === "year") {
    const year = Number(custom.year) || today.getFullYear()
    const startDate = new Date(year, 0, 1)
    const endDate = addYears(startDate, 1)

    return { startDate, endDate, label: `${year}` }
  }

  const startDate = parseDateInput(custom.date)
  return { startDate, endDate: addDays(startDate, 1), label: formatShortDate(startDate) }
}

function getChartData(orders: Order[], range: DateRange): ChartBucket[] {
  const rangeDays = Math.max(
    1,
    Math.ceil((range.endDate.getTime() - range.startDate.getTime()) / 86400000)
  )

  if (rangeDays <= 1) {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      label: `${hour.toString().padStart(2, "0")}:00`,
      revenue: 0,
      orders: 0,
    }))

    orders.forEach((order) => {
      const hour = new Date(order.createdAt).getHours()
      buckets[hour].revenue += order.total
      buckets[hour].orders += 1
    })

    return buckets
  }

  if (rangeDays <= 62) {
    const buckets: ChartBucket[] = []
    const indexByDate = new Map<string, number>()
    let cursor = startOfDay(range.startDate)

    while (cursor < range.endDate) {
      indexByDate.set(toInputDate(cursor), buckets.length)
      buckets.push({
        label: formatShortDate(cursor),
        revenue: 0,
        orders: 0,
      })
      cursor = addDays(cursor, 1)
    }

    orders.forEach((order) => {
      const key = toInputDate(new Date(order.createdAt))
      const index = indexByDate.get(key)
      if (index === undefined) return

      buckets[index].revenue += order.total
      buckets[index].orders += 1
    })

    return buckets
  }

  const buckets: ChartBucket[] = []
  const indexByMonth = new Map<string, number>()
  let cursor = startOfMonth(range.startDate)

  while (cursor < range.endDate) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`
    indexByMonth.set(key, buckets.length)
    buckets.push({
      label: cursor.toLocaleDateString("es-UY", { month: "short", year: "2-digit" }),
      revenue: 0,
      orders: 0,
    })
    cursor = addMonths(cursor, 1)
  }

  orders.forEach((order) => {
    const createdAt = new Date(order.createdAt)
    const key = `${createdAt.getFullYear()}-${createdAt.getMonth()}`
    const index = indexByMonth.get(key)
    if (index === undefined) return

    buckets[index].revenue += order.total
    buckets[index].orders += 1
  })

  return buckets
}

function isOrderInsideRange(order: Order, range: DateRange) {
  const createdAt = new Date(order.createdAt)
  return createdAt >= range.startDate && createdAt < range.endDate
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
  const todayInput = toInputDate(new Date())
  const currentMonthInput = todayInput.slice(0, 7)
  const currentYearInput = todayInput.slice(0, 4)
  const [period, setPeriod] = useState<PeriodOption>("today")
  const [customMode, setCustomMode] = useState<CustomPeriodMode>("date")
  const [customDate, setCustomDate] = useState(todayInput)
  const [customFrom, setCustomFrom] = useState(todayInput)
  const [customTo, setCustomTo] = useState(todayInput)
  const [customWeek, setCustomWeek] = useState("")
  const [customMonth, setCustomMonth] = useState(currentMonthInput)
  const [customYear, setCustomYear] = useState(currentYearInput)
  const {
    data: orders,
    isLoading,
    mutate,
  } = useSWR<Order[]>("/api/admin?type=orders", fetcher, {
    refreshInterval: 30000,
  })

  const selectedRange = getDateRangeFromPeriod(period, {
    mode: customMode,
    date: customDate,
    from: customFrom,
    to: customTo,
    week: customWeek,
    month: customMonth,
    year: customYear,
  })
  const allOrders = Array.isArray(orders) ? orders : []
  const selectedOrders = allOrders.filter((order) =>
    isOrderInsideRange(order, selectedRange)
  )
  const revenue = selectedOrders.reduce((sum, order) => sum + order.total, 0)
  const activeOrders = selectedOrders.filter(
    (order) => order.status !== "delivered" && order.status !== "cancelled"
  ).length
  const avgOrder = selectedOrders.length > 0 ? revenue / selectedOrders.length : 0
  const chartData = getChartData(selectedOrders, selectedRange)
  const busiestHour = chartData.reduce(
    (top, item) => (item.orders > top.orders ? item : top),
    chartData[0]
  )
  const deliveredOrders = selectedOrders.filter(
    (order) => order.status === "delivered"
  ).length
  const periodLabel = selectedRange.label

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
            Resumen de ventas y actividad para {periodLabel.toLowerCase()}.
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[220px] items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-white/70">
              <CalendarDays className="h-4 w-4 text-primary" />
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as PeriodOption)}
              >
                <SelectTrigger className="h-8 border-0 bg-transparent px-0 text-sm font-semibold text-white shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/[0.08] bg-[#151619] text-white">
                  {periodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {periodLabel}
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

          {period === "custom" && (
            <div className="grid w-full gap-2 rounded-[22px] border border-white/[0.08] bg-white/[0.04] p-3 sm:w-auto sm:grid-flow-col sm:auto-cols-max sm:items-end">
              <div className="min-w-[150px]">
                <p className="mb-1.5 text-xs font-medium text-white/45">Tipo</p>
                <Select
                  value={customMode}
                  onValueChange={(value) => setCustomMode(value as CustomPeriodMode)}
                >
                  <SelectTrigger className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-white/[0.08] bg-[#151619] text-white">
                    <SelectItem value="date">Fecha puntual</SelectItem>
                    <SelectItem value="range">Rango</SelectItem>
                    <SelectItem value="week">Semana</SelectItem>
                    <SelectItem value="month">Mes</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {customMode === "date" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-white/45">Dia</p>
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(event) => setCustomDate(event.target.value)}
                    className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                  />
                </div>
              )}

              {customMode === "range" && (
                <>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-white/45">Desde</p>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(event) => setCustomFrom(event.target.value)}
                      className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                    />
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-white/45">Hasta</p>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(event) => setCustomTo(event.target.value)}
                      className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                    />
                  </div>
                </>
              )}

              {customMode === "week" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-white/45">Semana</p>
                  <Input
                    type="week"
                    value={customWeek}
                    onChange={(event) => setCustomWeek(event.target.value)}
                    className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                  />
                </div>
              )}

              {customMode === "month" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-white/45">Mes</p>
                  <Input
                    type="month"
                    value={customMonth}
                    onChange={(event) => setCustomMonth(event.target.value)}
                    className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                  />
                </div>
              )}

              {customMode === "year" && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-white/45">Ano</p>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={customYear}
                    onChange={(event) => setCustomYear(event.target.value)}
                    className="h-10 rounded-full border-white/[0.08] bg-[#111214] text-white"
                  />
                </div>
              )}
            </div>
          )}

          <div className="rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm text-white/55">
            {new Date().toLocaleDateString("es-UY", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
        <MetricCard
          title="Ingresos"
          value={formatCurrency(revenue)}
          helper={`${selectedOrders.length} pedidos en el periodo`}
          icon={DollarSign}
        />
        <MetricCard
          title="Pedidos totales"
          value={`${selectedOrders.length}`}
          helper="Pedidos registrados en el periodo"
          icon={ShoppingBag}
          accent="muted"
        />
        <MetricCard
          title="Pedidos activos"
          value={`${activeOrders}`}
          helper={`${activeOrders} en progreso en el periodo`}
          icon={Clock}
          accent="accent"
        />
        <MetricCard
          title="Ticket promedio"
          value={formatCurrency(avgOrder)}
          helper="Promedio del periodo"
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
                Ingresos y pedidos del periodo seleccionado.
              </p>
            </div>
            <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary">
              {periodLabel}
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
              Distribucion rapida del periodo.
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
                  {deliveredOrders}/{selectedOrders.length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
                <span className="text-sm text-white/50">Activos</span>
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
              Ultimos pedidos recibidos en el periodo.
            </p>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-white/[0.08] bg-white/[0.04] px-3 py-1 text-white/55">
            {selectedOrders.length} en {periodLabel.toLowerCase()}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          {selectedOrders.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.025] text-center">
              <p className="text-sm font-medium text-white/70">Sin datos para este periodo</p>
              <p className="mt-1 text-xs text-white/40">
                Cambia el filtro o actualiza para consultar otro rango.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {selectedOrders.slice(0, 10).map((order) => {
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
