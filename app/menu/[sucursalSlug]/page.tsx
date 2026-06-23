import { notFound } from "next/navigation"
import { StorefrontShell } from "@/components/storefront/storefront-shell"
import {
  getBranchBySlug,
  getCategories,
  getModifierGroups,
  getProducts,
} from "@/lib/supabase/queries"
import type { Category, ModifierGroup, Product } from "@/lib/types"

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

  try {
    ;[categories, products, modifierGroups] = await Promise.all([
      getCategories(branch.id),
      getProducts(branch.id),
      getModifierGroups(branch.id),
    ])
  } catch {
    categories = []
    products = []
    modifierGroups = []
  }

  return (
    <StorefrontShell
      branch={branch}
      categories={categories}
      products={products}
      modifierGroups={modifierGroups}
    />
  )
}
