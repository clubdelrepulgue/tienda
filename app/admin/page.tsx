"use client"

import useSWR from "swr"
import { DollarSign, ShoppingBag, Clock, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const statusConfig: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  new: { label: "New", className: "bg-chart-1/15 text-chart-1 border-chart-1/20" },
  accepted: { label: "Accepted", className: "bg-chart-2/15 text-chart-2 border-chart-2/20" },
  preparing: { label: "Preparing", className: "bg-accent/15 text-accent border-accent/20" },
  ready: { label: "Ready", className: "bg-chart-3/15 text-chart-3 border-chart-3/20" },
  delivered: { label: "Delivered", className: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive border-destructive/20" },
}

export default function AdminDashboard() {
  const { data: orders, isLoading } = useSWR<Order[]>(
    "/api/admin?type=orders",
    fetcher,
    { refreshInterval: 30000 }
  )

  const todayOrders = Array.isArray(orders) ? orders : []
  const revenue = todayOrders.reduce((sum, o) => sum + o.total, 0)
  const activeOrders = todayOrders.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled"
  ).length

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-40 mt-2" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      <div>
        <h1
          className="text-2xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {"Today's overview"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">
              ${revenue.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-chart-3" />
              {todayOrders.length} orders today
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Orders
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">
              {todayOrders.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Today</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
            <Clock className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">
              {activeOrders}
            </p>
            <p className="text-xs text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg. Order
            </CardTitle>
            <DollarSign className="h-4 w-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-card-foreground">
              ${todayOrders.length > 0 ? (revenue / todayOrders.length).toFixed(2) : "0.00"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Per order</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card className="rounded-2xl bg-card border-border">
        <CardHeader>
          <CardTitle
            className="text-lg font-bold text-card-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Recent Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No orders yet
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {todayOrders.slice(0, 10).map((order) => {
                const config = statusConfig[order.status]
                return (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-xl bg-secondary/50 p-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {order.orderNumber && (
                          <span className="text-xs font-mono text-muted-foreground">
                            #{order.orderNumber}
                          </span>
                        )}
                        <p className="font-medium text-sm text-card-foreground truncate">
                          {order.customerName}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0 text-xs font-medium",
                            config.className
                          )}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {order.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-sm text-card-foreground">
                        ${order.total.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
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
