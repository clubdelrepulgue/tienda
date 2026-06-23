"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Branch, CartItem, CartItemModifier, PaymentMethod, Product } from "./types"

type CartBranch = Pick<Branch, "id" | "slug" | "name">
type CheckoutDeliveryMethod = "delivery" | "pickup"
type CheckoutLocation = { lat: number; lng: number; address: string }

type CartMutationResult = {
  success: boolean
  error?: string
}

const PERSISTENCE_TTL_MS = 48 * 60 * 60 * 1000
const CART_STORAGE_KEY = "el-club-del-repulgue-cart"
const CHECKOUT_DRAFT_STORAGE_KEY = "el-club-del-repulgue-checkout-draft"

function nextExpiresAt() {
  return Date.now() + PERSISTENCE_TTL_MS
}

function isExpired(expiresAt?: number | null) {
  return typeof expiresAt === "number" && expiresAt <= Date.now()
}

interface CartStore {
  branchId: string | null
  branchSlug: string | null
  branchName: string | null
  items: CartItem[]
  expiresAt: number | null
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

type CheckoutDraftValues = {
  branchId: string | null
  deliveryMethod: CheckoutDeliveryMethod
  paymentMethod: PaymentMethod
  name: string
  phone: string
  address: string
  notes: string
  selectedLocation: CheckoutLocation | null
}

interface CheckoutDraftStore extends CheckoutDraftValues {
  expiresAt: number | null
  setDraft: (draft: Partial<CheckoutDraftValues>) => void
  clearDraft: () => void
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

const emptyCartState = {
  branchId: null,
  branchSlug: null,
  branchName: null,
  items: [],
  expiresAt: null,
}

const defaultCheckoutDraft: CheckoutDraftValues = {
  branchId: null,
  deliveryMethod: "delivery",
  paymentMethod: "mercadopago",
  name: "",
  phone: "",
  address: "",
  notes: "",
  selectedLocation: null,
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      ...emptyCartState,

      setBranchContext: (branch) => {
        const state = get()
        if (state.items.length > 0 && state.branchId && state.branchId !== branch.id) {
          return { success: false, error: branchMismatchMessage(state.branchName) }
        }

        set({
          branchId: branch.id,
          branchSlug: branch.slug,
          branchName: branch.name,
          expiresAt: nextExpiresAt(),
        })

        return { success: true }
      },

      clearCartAndSetBranch: (branch) => {
        set({
          branchId: branch.id,
          branchSlug: branch.slug,
          branchName: branch.name,
          items: [],
          expiresAt: nextExpiresAt(),
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
            expiresAt: nextExpiresAt(),
          })
        } else {
          set({
            branchId: branch?.id || state.branchId || item.branchId,
            branchSlug: branch?.slug || state.branchSlug,
            branchName: branch?.name || state.branchName,
            items: [...get().items, { ...item, id: generateId() }],
            expiresAt: nextExpiresAt(),
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
            expiresAt: nextExpiresAt(),
          })
          return { success: true }
        }

        return get().addItem(newItem)
      },

      removeItem: (id) => {
        set({ items: get().items.filter((i) => i.id !== id), expiresAt: nextExpiresAt() })
      },

      updateQty: (id, quantity) => {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.id !== id), expiresAt: nextExpiresAt() })
        } else {
          set({
            items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)),
            expiresAt: nextExpiresAt(),
          })
        }
      },

      clearCart: () => set(emptyCartState),

      totalPrice: () => {
        return get().items.reduce((total, item) => {
          const modifiersPrice = item.modifiers.reduce((sum, m) => sum + m.price, 0)
          return total + (item.price + modifiersPrice) * item.quantity
        }, 0)
      },

      totalItems: () => {
        return get().items.reduce((total, item) => total + item.quantity, 0)
      },
    }),
    {
      name: CART_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        branchId: state.branchId,
        branchSlug: state.branchSlug,
        branchName: state.branchName,
        items: state.items,
        expiresAt: state.expiresAt,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CartStore> | undefined
        if (!persisted || isExpired(persisted.expiresAt)) return currentState
        return { ...currentState, ...persisted }
      },
    }
  )
)

export const useCheckoutDraftStore = create<CheckoutDraftStore>()(
  persist(
    (set) => ({
      ...defaultCheckoutDraft,
      expiresAt: null,

      setDraft: (draft) => {
        set({
          ...draft,
          expiresAt: nextExpiresAt(),
        })
      },

      clearDraft: () => {
        set({
          ...defaultCheckoutDraft,
          expiresAt: null,
        })
      },
    }),
    {
      name: CHECKOUT_DRAFT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        branchId: state.branchId,
        deliveryMethod: state.deliveryMethod,
        paymentMethod: state.paymentMethod,
        name: state.name,
        phone: state.phone,
        address: state.address,
        notes: state.notes,
        selectedLocation: state.selectedLocation,
        expiresAt: state.expiresAt,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CheckoutDraftStore> | undefined
        if (!persisted || isExpired(persisted.expiresAt)) return currentState
        return { ...currentState, ...persisted }
      },
    }
  )
)
