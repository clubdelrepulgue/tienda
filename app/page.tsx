import { StorefrontShell } from "@/components/storefront/storefront-shell"
import { getCategories, getProducts, getModifierGroups } from "@/lib/supabase/queries"
import type { Category, Product, ModifierGroup } from "@/lib/types"

export default async function StorefrontPage() {
  let categories: Category[] = [], products: Product[] = [], modifierGroups: ModifierGroup[] = []

  try {
    ;[categories, products, modifierGroups] = await Promise.all([
      getCategories(),
      getProducts(),
      getModifierGroups(),
    ])
  } catch {
    categories = []
    products = []
    modifierGroups = []
  }

  return (
    <StorefrontShell
      categories={categories}
      products={products}
      modifierGroups={modifierGroups}
    />
  )
}
