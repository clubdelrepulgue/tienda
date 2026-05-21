"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  Sliders,
  Building2,
  ChevronLeft,
  Menu,
  LogOut,
  Tags,
  ShoppingBag,
  ChefHat,
  Tag,
  Bike,
  Sparkles,
  Map as MapIcon,
  PackageCheck,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/admin/pos", label: "POS / Mostrador", icon: ShoppingBag },
  { href: "/admin/dispatch", label: "Dispatch", icon: PackageCheck },
  { href: "/admin/live-tracking", label: "Live Tracking", icon: MapIcon },
]

const configItems = [
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/modifiers", label: "Modifiers", icon: Sliders },
  { href: "/admin/branches", label: "Sucursales", icon: Building2 },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/upsells", label: "Upsells", icon: Sparkles },
  { href: "/admin/drivers", label: "Drivers", icon: Bike },
]

function NavItem({ item, pathname }: { item: typeof navItems[0]; pathname: string }) {
  const isActive =
    item.href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(item.href)
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

function NavContent({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col">
      {/* Main Operations */}
      <div className="px-3 py-2">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider mb-1">
          Operations
        </p>
        <div className="flex flex-col gap-0.5">
          {navItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </div>

      {/* Configuration */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <p className="text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider mb-1">
          Configuration
        </p>
        <div className="flex flex-col gap-0.5">
          {configItems.map((item) => (
            <NavItem key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      </div>
    </nav>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/admin/login")
  }

  if (pathname === "/admin/login") {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <Link href="/admin" className="flex items-center gap-2">
            <span
              className="text-lg font-bold text-sidebar-primary"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              BLAZR
            </span>
            <span className="text-xs bg-sidebar-accent text-sidebar-accent-foreground px-2 py-0.5 rounded-full font-medium">
              Admin
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground"
            asChild
          >
            <Link href="/" aria-label="Back to storefront">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <NavContent pathname={pathname} />
        </ScrollArea>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header + Sheet */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-50 flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9" suppressHydrationWarning>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 p-0 bg-sidebar border-sidebar-border">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex items-center gap-2 p-4 border-b border-sidebar-border">
                <span
                  className="text-lg font-bold text-sidebar-primary"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  BLAZR
                </span>
                <span className="text-xs bg-sidebar-accent text-sidebar-accent-foreground px-2 py-0.5 rounded-full font-medium">
                  Admin
                </span>
              </div>
              <div onClick={() => setMobileOpen(false)}>
                <NavContent pathname={pathname} />
              </div>
            </SheetContent>
          </Sheet>
          <span
            className="text-base font-bold text-foreground"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            BLAZR Admin
          </span>
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
