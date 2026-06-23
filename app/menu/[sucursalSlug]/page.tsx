import { notFound } from "next/navigation"
import { StorefrontShell } from "@/components/storefront/storefront-shell"
import {
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
