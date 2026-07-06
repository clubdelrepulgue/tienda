import { notFound } from "next/navigation"
import { StorefrontShell } from "@/components/storefront/storefront-shell"

// Cache each branch menu and refresh it in background at most every 60s
export const revalidate = 60

export async function generateStaticParams() {
  try {
    const branches = await getBranches()
    return branches.map((branch) => ({ sucursalSlug: branch.slug }))
  } catch {
    return []
  }
}
import {
  getBranches,
  getBranchBySlug,
  getCategories,
  getModifierGroups,
  getProducts,
  getUpsellRules,
} from "@/lib/supabase/queries"
import type { Category, ModifierGroup, Product, UpsellRule } from "@/lib/types"

export default async function BranchMenuPage({
  params,
}: {
  params: Promise<{ sucursalSlug: string }>
}) {
  const { sucursalSlug } = await params
  const branch = await getBranchBySlug(sucursalSlug)

  if (!branch || !branch.isOpen) notFound()

  let categories: Category[] = []
  let products: Product[] = []
  let modifierGroups: ModifierGroup[] = []
  let upsellRules: UpsellRule[] = []

  try {
    ;[categories, products, modifierGroups, upsellRules] = await Promise.all([
      getCategories(branch.id),
      getProducts(branch.id),
      getModifierGroups(branch.id),
      getUpsellRules(branch.id),
    ])
  } catch {
    categories = []
    products = []
    modifierGroups = []
    upsellRules = []
  }

  return (
    <StorefrontShell
      branch={branch}
      categories={categories}
      products={products}
      modifierGroups={modifierGroups}
      upsellRules={upsellRules}
    />
  )
}
