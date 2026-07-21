"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Sliders,
  Building2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  LogOut,
  Tags,
  ShoppingBag,
  ChefHat,
  Tag,
  Bike,
  Sparkles,
  PackageCheck,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useActiveBranch } from "./branch-context"
import { BranchSwitcher } from "./branch-switcher"

const FALLBACK_LOGO = "/assets/brand/logo.jpeg"

type AdminNavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const navItems: AdminNavItem[] = [
  { href: "/admin", label: "Panel", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/kitchen", label: "Cocina", icon: ChefHat },
  { href: "/admin/pos", label: "POS / Mostrador", icon: ShoppingBag },
  { href: "/admin/dispatch", label: "Despacho y Seguimiento", icon: PackageCheck },
]

const configItems: AdminNavItem[] = [
  { href: "/admin/categories", label: "Categorias", icon: Tags },
  { href: "/admin/products", label: "Productos", icon: Package },
  { href: "/admin/modifiers", label: "Modificadores", icon: Sliders },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/branches", label: "Sucursales", icon: Building2 },
  { href: "/admin/coupons", label: "Cupones", icon: Tag },
  { href: "/admin/upsells", label: "Sugerencias", icon: Sparkles },
  { href: "/admin/drivers", label: "Repartidores", icon: Bike },
]

function NavItem({
  item,
  pathname,
  collapsed = false,
}: {
  item: AdminNavItem
  pathname: string
  collapsed?: boolean
}) {
  const isActive =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href)

  const link = (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "group flex items-center rounded-2xl text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-150",
        collapsed ? "h-11 justify-center px-2" : "gap-3 px-3 py-2",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_14px_30px_rgba(255,56,56,0.18)]"
          : "text-sidebar-foreground/62 hover:bg-white/[0.045] hover:text-sidebar-foreground"
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-xl transition-colors",
          collapsed ? "h-9 w-9" : "h-8 w-8",
          isActive ? "bg-white/12" : "bg-transparent group-hover:bg-white/[0.06]"
        )}
      >
        <item.icon className={cn(collapsed ? "h-5 w-5" : "h-[18px] w-[18px]")} />
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="font-semibold">
        {item.label}
      </TooltipContent>
    </Tooltip>
  )
}

function NavContent({
  pathname,
  collapsed = false,
}: {
  pathname: string
  collapsed?: boolean
}) {
  return (
    <nav className="flex flex-col gap-1.5 py-2">
      {/* Main Operations */}
      <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
        {collapsed ? (
          <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border/80" />
        ) : (
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/38">
            Operacion
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className={cn("border-t border-sidebar-border/80 py-3", collapsed ? "px-2" : "px-3")}>
        {collapsed ? (
          <div className="mx-auto mb-2 h-px w-8 bg-sidebar-border/80" />
        ) : (
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/38">
            Configuracion
          </p>
        )}
        <div className="flex flex-col gap-0.5">
          {configItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { activeBranch } = useActiveBranch()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const logoSrc = activeBranch?.logoUrl || FALLBACK_LOGO
  const brandName = activeBranch?.name || "El Club del Repulgue"

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col overflow-hidden border-r border-sidebar-border/80 bg-sidebar transition-[width] duration-300 ease-in-out md:flex",
          sidebarCollapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className={cn("shrink-0 border-b border-sidebar-border/80 py-3", sidebarCollapsed ? "px-2" : "px-4")}>
          <div className={cn("flex items-center gap-2", sidebarCollapsed ? "flex-col justify-center" : "justify-between")}>
            <Link
              href="/admin"
              className={cn(
                "min-w-0 items-center justify-center gap-2 overflow-hidden transition-[opacity,width] duration-200",
                sidebarCollapsed ? "flex w-full opacity-100" : "flex opacity-100"
              )}
              aria-label={`${brandName} Admin`}
            >
              <Image
                key={logoSrc}
                src={logoSrc}
                alt={brandName}
                width={160}
                height={32}
                priority
                unoptimized
                className={cn("h-7 w-auto shrink-0", sidebarCollapsed && "max-w-12")}
              />
              <span className={cn(
                "rounded-full border border-white/[0.07] bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-sidebar-accent-foreground",
                sidebarCollapsed && "hidden"
              )}>
                Admin
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="h-9 w-9 shrink-0 rounded-full border border-white/[0.07] bg-white/[0.035] text-sidebar-foreground/62 hover:bg-white/[0.07] hover:text-sidebar-foreground"
                  aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                >
                  {sidebarCollapsed ? (
                    <ChevronsRight className="h-5 w-5" />
                  ) : (
                    <ChevronsLeft className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                {sidebarCollapsed ? "Expandir" : "Colapsar"}
              </TooltipContent>
            </Tooltip>
          </div>
          <Button
            variant="ghost"
            size={sidebarCollapsed ? "icon" : "sm"}
            className={cn(
              "mt-2 rounded-full text-sidebar-foreground/45 hover:bg-white/[0.06] hover:text-sidebar-foreground",
              sidebarCollapsed ? "mx-auto flex h-9 w-9" : "h-8 px-3"
            )}
            asChild
          >
            <Link href="/" aria-label="Volver al menu">
              <ChevronLeft className="h-4 w-4" />
              {!sidebarCollapsed && <span>Menu</span>}
            </Link>
          </Button>
          <div className={cn("mt-3", sidebarCollapsed && "px-0")}>
            <BranchSwitcher collapsed={sidebarCollapsed} pathname={pathname} />
          </div>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <NavContent pathname={pathname} collapsed={sidebarCollapsed} />
        </ScrollArea>
        <div className={cn("shrink-0 border-t border-sidebar-border/80", sidebarCollapsed ? "p-2" : "p-3")}>
          <SignOutButton onClick={handleSignOut} collapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <header className="z-50 flex shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" suppressHydrationWarning>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Abrir navegacion</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex h-dvh max-h-dvh w-64 flex-col border-sidebar-border bg-sidebar p-0">
              <SheetTitle className="sr-only">Navegacion</SheetTitle>
              <div className="flex shrink-0 flex-col gap-3 border-b border-sidebar-border/80 p-4">
                <div className="flex items-center gap-2">
                  <Image key={logoSrc} src={logoSrc} alt={brandName} width={160} height={32} priority unoptimized className="h-7 w-auto" />
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-sidebar-accent-foreground">
                    Admin
                  </span>
                </div>
                <BranchSwitcher pathname={pathname} />
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <div onClick={() => setMobileOpen(false)}>
                  <NavContent pathname={pathname} />
                </div>
              </ScrollArea>
              <div className="shrink-0 border-t border-sidebar-border/80 p-3">
                <SignOutButton
                  onClick={() => {
                    setMobileOpen(false)
                    handleSignOut()
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
          <span
            className="text-base font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {brandName}
          </span>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8 md:py-8 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  )
}

function SignOutButton({
  onClick,
  collapsed = false,
}: {
  onClick: () => void
  collapsed?: boolean
}) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center rounded-2xl text-sm font-semibold text-sidebar-foreground/55 transition-colors hover:bg-white/[0.045] hover:text-sidebar-foreground",
        collapsed ? "h-11 justify-center px-2" : "gap-3 px-3 py-2"
      )}
      aria-label={collapsed ? "Cerrar sesion" : undefined}
    >
      <span className={cn("grid place-items-center rounded-xl", collapsed ? "h-9 w-9" : "h-8 w-8")}>
        <LogOut className={cn("shrink-0", collapsed ? "h-5 w-5" : "h-[18px] w-[18px]")} />
      </span>
      {!collapsed && <span>Cerrar sesion</span>}
    </button>
  )

  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="font-semibold">
        Cerrar sesion
      </TooltipContent>
    </Tooltip>
  )
}
