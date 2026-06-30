import { cookies } from "next/headers"
import { getAdminScope } from "@/lib/admin-scope"
import { getBranches } from "@/lib/supabase/queries"
import {
  ACTIVE_BRANCH_COOKIE,
  branchThemeStyle,
  resolveActiveBranchId,
} from "@/lib/active-branch"
import { AdminBranchProvider } from "./branch-context"
import AdminShell from "./admin-shell"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const scope = await getAdminScope()

  const allBranches = scope ? await getBranches() : []
  const branches = scope?.isGlobalAdmin
    ? allBranches
    : allBranches.filter((branch) => branch.id === scope?.branchId)

  const cookieStore = await cookies()
  const preferredBranchId = cookieStore.get(ACTIVE_BRANCH_COOKIE)?.value
  const activeBranchId = resolveActiveBranchId(scope, branches, preferredBranchId)
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null

  return (
    <div id="admin-root" style={branchThemeStyle(activeBranch)}>
      <AdminBranchProvider
        scope={scope}
        initialBranches={branches}
        initialBranchId={activeBranchId}
      >
        <AdminShell>{children}</AdminShell>
      </AdminBranchProvider>
    </div>
  )
}
