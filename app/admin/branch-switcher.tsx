"use client"

import { Building2, Info } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useActiveBranch } from "./branch-context"

// Pages whose data is shared across every sucursal. The switcher stays visible
// for context but is disabled with a note so changing it never looks like it
// silently filters these screens.
const GLOBAL_ADMIN_ROUTES = [
  "/admin/users",
  "/admin/drivers",
  "/admin/coupons",
  "/admin/branches",
]

function isGlobalRoute(pathname: string) {
  return GLOBAL_ADMIN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  )
}

export function BranchSwitcher({
  collapsed = false,
  pathname,
}: {
  collapsed?: boolean
  pathname: string
}) {
  const { branches, activeBranch, activeBranchId, setActiveBranchId, isGlobalAdmin } =
    useActiveBranch()

  // Nothing to switch between yet.
  if (branches.length === 0) return null

  const global = isGlobalRoute(pathname)

  // Collapsed sidebar: show just an icon button with a tooltip.
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "mx-auto grid h-9 w-9 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.04] text-sidebar-foreground/70",
              global && "opacity-50"
            )}
          >
            <Building2 className="h-4 w-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="font-semibold">
          {global
            ? "Configuracion compartida (todas las sucursales)"
            : activeBranch?.name || "Sucursal"}
        </TooltipContent>
      </Tooltip>
    )
  }

  // Single-branch users can't switch — show a static label.
  if (!isGlobalAdmin || branches.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-2 text-sm font-semibold text-sidebar-foreground/80">
        <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/55" />
        <span className="truncate">{activeBranch?.name || branches[0]?.name}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Select
        value={activeBranchId ?? undefined}
        onValueChange={setActiveBranchId}
        disabled={global}
      >
        <SelectTrigger
          className={cn(
            "h-auto w-full rounded-xl border-white/[0.07] bg-white/[0.04] py-2 text-sm font-semibold text-sidebar-foreground hover:bg-white/[0.07]",
            global && "opacity-60"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-sidebar-foreground/55" />
            <SelectValue placeholder="Sucursal" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {global && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] font-medium leading-tight text-sidebar-foreground/45">
          <Info className="h-3 w-3 shrink-0" />
          Esta seccion aplica a todas las sucursales
        </p>
      )}
    </div>
  )
}
