import { createClient } from "@/lib/supabase/server"
import type { AdminScope } from "@/lib/types"

const GLOBAL_ROLES = new Set(["owner", "admin"])

export async function getAdminScope(): Promise<AdminScope | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("admin_users")
    .select("role, sucursal_id")
    .eq("user_id", user.id)
    .single()

  if (!data) return null

  const role = data.role as AdminScope["role"]

  return {
    userId: user.id,
    role,
    branchId: data.sucursal_id || null,
    isGlobalAdmin: GLOBAL_ROLES.has(role),
  }
}

export function getEffectiveBranchId(
  scope: AdminScope | null,
  requestedBranchId?: string | null
) {
  if (!scope) return requestedBranchId || undefined
  if (scope.isGlobalAdmin) return requestedBranchId || undefined
  return scope.branchId || "__no_branch_access__"
}

export function canAccessBranch(scope: AdminScope | null, branchId: string) {
  if (!scope) return true
  if (scope.isGlobalAdmin) return true
  return scope.branchId === branchId
}
