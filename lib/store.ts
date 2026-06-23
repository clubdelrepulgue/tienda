"use client"

import { create } from "zustand"
import type { Branch, CartItem, CartItemModifier, Product } from "./types"

type CartBranch = Pick<Branch, "id" | "slug" | "name">

type CartMutationResult = {
  success: boolean
  error?: string
}

interface CartStore {
  branchId: string | null
  branchSlug: string | null
  branchName: string | null
  items: CartItem[]
  setBranchContext: (branch: CartBranch) => CartMutationResult
  clearCartAndSetBranch: (branch: CartBranch) => void
  addItem: (item: Omit<CartItem, "id">, branch?: CartBranch) => CartMutationResult
  addProduct: (product: Product, modifiers: CartItemModifier[], overridePrice?: number) => CartMutationResult
  removeItem: (id: string) => void
  updateQty: (id: string, quantity: number) => void
  clearCart: () => void
  totalPrice: () => number
  totalItems: () => number
}

function generateId() {
  return Math.random().toString(36).substring(2, 9)
}

function getModifiersKey(modifiers: CartItemModifier[]) {
  return modifiers
    .map((m) => `${m.groupId}:${m.optionId}`)
    .sort()
    .join("|")
}

function branchMismatchMessage(branchName: string | null) {
  const current = branchName ? ` de ${branchName}` : ""
  return `Tu carrito actual${current} pertenece a otra sucursal. Vacialo para cambiar de menu.`
}

export const useCartStore = create<CartStore>((set, get) => ({
  branchId: null,
  branchSlug: null,
  branchName: null,
  items: [],

  setBranchContext: (branch) => {
    const state = get()
    if (state.items.length > 0 && state.branchId && state.branchId !== branch.id) {
      return { success: false, error: branchMismatchMessage(state.branchName) }
    }

    set({
      branchId: branch.id,
      branchSlug: branch.slug,
      branchName: branch.name,
    })

    return { success: true }
  },

  clearCartAndSetBranch: (branch) => {
    set({
      branchId: branch.id,
      branchSlug: branch.slug,
      branchName: branch.name,
      items: [],
    })
  },

  addItem: (item, branch) => {
    const state = get()
    const nextBranchId = branch?.id || item.branchId

    if (state.items.length > 0 && state.branchId && state.branchId !== nextBranchId) {
      return { success: false, error: branchMismatchMessage(state.branchName) }
    }

    const existingItem = get().items.find(
      (i) =>
        i.productId === item.productId &&
        getModifiersKey(i.modifiers) === getModifiersKey(item.modifiers)
    )

    if (existingItem) {
      set({
        items: get().items.map((i) =>
          i.id === existingItem.id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      })
    } else {
      set({
        branchId: branch?.id || state.branchId || item.branchId,
        branchSlug: branch?.slug || state.branchSlug,
        branchName: branch?.name || state.branchName,
        items: [...get().items, { ...item, id: generateId() }],
      })
    }

    return { success: true }
  },

  addProduct: (product, modifiers, overridePrice) => {
    const finalPrice = overridePrice !== undefined ? overridePrice : product.price
    
    const newItem: Omit<CartItem, "id"> = {
      productId: product.id,
      branchId: product.branchId,
      name: product.name,
      image: product.image,
      price: finalPrice,
      quantity: 1,
      modifiers,
    }

    const existingItem = get().items.find(
      (i) =>
        i.productId === newItem.productId &&
        getModifiersKey(i.modifiers) === getModifiersKey(newItem.modifiers) &&
        i.price === finalPrice // Also check price for upsells
    )

    if (existingItem) {
      set({
        items: get().items.map((i) =>
          i.id === existingItem.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      })
      return { success: true }
    } else {
      return get().addItem(newItem)
    }
  },

  removeItem: (id) => {
    set({ items: get().items.filter((i) => i.id !== id) })
  },

  updateQty: (id, quantity) => {
    if (quantity <= 0) {
      set({ items: get().items.filter((i) => i.id !== id) })
    } else {
      set({
        items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)),
      })
    }
  },

  clearCart: () => set({ branchId: null, branchSlug: null, branchName: null, items: [] }),

  totalPrice: () => {
    return get().items.reduce((total, item) => {
      const modifiersPrice = item.modifiers.reduce((sum, m) => sum + m.price, 0)
      return total + (item.price + modifiersPrice) * item.quantity
    }, 0)
  },

  totalItems: () => {
    return get().items.reduce((total, item) => total + item.quantity, 0)
  },
}))
