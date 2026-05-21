import { StorefrontShell } from "@/components/storefront/storefront-shell";
import {
  getCategories,
  getModifierGroups,
  getProducts,
} from "@/lib/supabase/queries";
import type { Category, ModifierGroup, Product } from "@/lib/types";

export default async function MenuPage() {
  let categories: Category[] = [];
  let products: Product[] = [];
  let modifierGroups: ModifierGroup[] = [];

  try {
    [categories, products, modifierGroups] = await Promise.all([
      getCategories(),
      getProducts(),
      getModifierGroups(),
    ]);
  } catch {
    categories = [];
    products = [];
    modifierGroups = [];
  }

  return (
    <StorefrontShell
      categories={categories}
      products={products}
      modifierGroups={modifierGroups}
    />
  );
}
