"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import useSWR from "swr"
import type { AdminScope, Branch } from "@/lib/types"
import {
  ACTIVE_BRANCH_COOKIE,
  ACTIVE_BRANCH_MAX_AGE,
  applyBranchThemeVars,
  resolveActiveBranchId,
} from "@/lib/active-branch"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

type SessionResponse = {
  scope: AdminScope | null
  branches: Branch[]
  activeBranchId: string | null
}

type BranchContextValue = {
  branches: Branch[]
  activeBranch: Branch | null
  activeBranchId: string | null
  setActiveBranchId: (id: string) => void
  isGlobalAdmin: boolean
  isLoading: boolean
}

const BranchContext = createContext<BranchContextValue | null>(null)

export function AdminBranchProvider({
  scope,
  initialBranches,
  initialBranchId,
  children,
}: {
  scope: AdminScope | null
  initialBranches: Branch[]
  initialBranchId: string | null
  children: React.ReactNode
}) {
  // Keep branches/scope fresh after the initial server render (e.g. when a new
  // sucursal is created) while seeding with the server-provided data so the
  // first paint never flickers.
  const { data, isLoading } = useSWR<SessionResponse>(
    "/api/admin?type=session",
    fetcher,
    {
      fallbackData: {
        scope,
        branches: initialBranches,
        activeBranchId: initialBranchId,
      },
    }
  )

  const branches = data?.branches ?? initialBranches
  const effectiveScope = data?.scope ?? scope
  const isGlobalAdmin = effectiveScope?.isGlobalAdmin ?? false

  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(
    initialBranchId
  )

  const setActiveBranchId = useCallback(
    (id: string) => {
      setActiveBranchIdState(id)
      try {
        document.cookie = `${ACTIVE_BRANCH_COOKIE}=${id}; path=/; max-age=${ACTIVE_BRANCH_MAX_AGE}; samesite=lax`
        localStorage.setItem(ACTIVE_BRANCH_COOKIE, id)
      } catch {
        // ignore storage/cookie write failures (private mode, etc.)
      }
    },
    []
  )

  // If the resolved branch ever becomes invalid (deleted branch, scope change,
  // or no selection yet) fall back to a valid one.
  useEffect(() => {
    const valid =
      activeBranchId && branches.some((b) => b.id === activeBranchId)
    if (valid) return
    const next = resolveActiveBranchId(effectiveScope, branches, activeBranchId)
    if (next && next !== activeBranchId) setActiveBranchIdState(next)
  }, [activeBranchId, branches, effectiveScope])

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId]
  )

  // Keep the server-rendered admin root in sync with the selected branch.
  useEffect(() => {
    const root = document.getElementById("admin-root")
    if (root) applyBranchThemeVars(root, activeBranch)
  }, [activeBranch])

  const value = useMemo<BranchContextValue>(
    () => ({
      branches,
      activeBranch,
      activeBranchId,
      setActiveBranchId,
      isGlobalAdmin,
      isLoading,
    }),
    [branches, activeBranch, activeBranchId, setActiveBranchId, isGlobalAdmin, isLoading]
  )

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>
}

export function useActiveBranch() {
  const ctx = useContext(BranchContext)
  if (!ctx) {
    throw new Error("useActiveBranch must be used within an AdminBranchProvider")
  }
  return ctx
}
