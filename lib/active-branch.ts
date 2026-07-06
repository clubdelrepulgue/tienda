import type { CSSProperties } from "react"
import type { AdminScope, Branch } from "./types"

// Shared name for the cookie + localStorage key that holds the admin's
// currently selected sucursal. Read on the server (layout theming) and
// written on the client (branch switcher).
export const ACTIVE_BRANCH_COOKIE = "active_branch_id"
export const ACTIVE_BRANCH_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

const DEFAULT_BRAND_COLOR = "#E86303"
const DEFAULT_ACCENT_COLOR = "#F97316"

/**
 * Resolve which sucursal should be active given the user's scope, the
 * branches they can see and an optional preferred id (from the cookie).
 * Non-global admins are always locked to their own branch.
 */
export function resolveActiveBranchId(
  scope: AdminScope | null,
  branches: Pick<Branch, "id">[],
  preferredId?: string | null
): string | null {
  if (scope && !scope.isGlobalAdmin) return scope.branchId ?? null
  if (preferredId && branches.some((b) => b.id === preferredId)) return preferredId
  return branches[0]?.id ?? null
}

/**
 * CSS variable overrides for the active branch. Applied as an inline style on
 * the admin root (server-side, so no theme flash) and kept in sync on the
 * client when the branch changes. Only re-colors the brand/primary tokens the
 * admin actually paints with.
 */
export function branchThemeStyle(
  branch: Pick<Branch, "brandColor"> | null | undefined
): CSSProperties {
  const brand = branch?.brandColor || DEFAULT_BRAND_COLOR
  return {
    "--primary": brand,
    "--sidebar-primary": brand,
    "--sidebar-ring": brand,
    "--ring": brand,
    "--chart-1": brand,
  } as CSSProperties
}

// Keys touched by branchThemeStyle — used to push updates imperatively on the
// client without re-rendering the server-provided root element.
export const BRANCH_THEME_VARS = [
  "--primary",
  "--sidebar-primary",
  "--sidebar-ring",
  "--ring",
  "--chart-1",
] as const

export function applyBranchThemeVars(
  el: HTMLElement,
  branch: Pick<Branch, "brandColor"> | null | undefined
) {
  const brand = branch?.brandColor || DEFAULT_BRAND_COLOR
  for (const key of BRANCH_THEME_VARS) {
    el.style.setProperty(key, brand)
  }
}

export { DEFAULT_BRAND_COLOR, DEFAULT_ACCENT_COLOR }
