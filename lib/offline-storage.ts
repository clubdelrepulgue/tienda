import type { Branch, Category, DeliveryZone, ModifierGroup, Order, Product, UpsellRule } from "./types"

const DATABASE_NAME = "el-club-del-repulgue-offline"
const DATABASE_VERSION = 1
const STORE_NAME = "snapshots"
const MENU_MAX_AGE_MS = 24 * 60 * 60 * 1000

export type MenuSnapshot = {
  kind: "menu"
  key: string
  updatedAt: number
  branch: Branch
  categories: Category[]
  products: Product[]
  modifierGroups: ModifierGroup[]
  upsellRules: UpsellRule[]
}

export type DriverSnapshot = {
  kind: "driver"
  key: string
  updatedAt: number
  orders: Order[]
  branchLocations: Record<string, { lat: number; lng: number }>
  deliveryZones: Record<string, DeliveryZone>
}

type Snapshot = MenuSnapshot | DriverSnapshot

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible"))
      return
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode)
      const request = run(transaction.objectStore(STORE_NAME))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      transaction.onerror = () => reject(transaction.error)
    })
  } finally {
    database.close()
  }
}

async function putSnapshot(snapshot: Snapshot) {
  await transact<IDBValidKey>("readwrite", (store) => store.put(snapshot))
}

async function getSnapshot<T extends Snapshot>(key: string): Promise<T | null> {
  const result = await transact<Snapshot | undefined>("readonly", (store) => store.get(key))
  return (result as T | undefined) ?? null
}

export const menuSnapshots = {
  async save(data: Omit<MenuSnapshot, "kind" | "key" | "updatedAt">) {
    await putSnapshot({
      ...data,
      kind: "menu",
      key: `menu:${data.branch.slug}`,
      updatedAt: Date.now(),
    })
  },
  async read(slug: string) {
    const snapshot = await getSnapshot<MenuSnapshot>(`menu:${slug}`)
    if (!snapshot || Date.now() - snapshot.updatedAt > MENU_MAX_AGE_MS) return null
    return snapshot
  },
}

export const driverSnapshots = {
  async save(
    driverId: string,
    data: Pick<DriverSnapshot, "orders" | "branchLocations" | "deliveryZones">
  ) {
    await putSnapshot({
      ...data,
      kind: "driver",
      key: `driver:${driverId}`,
      updatedAt: Date.now(),
    })
  },
  read(driverId: string) {
    return getSnapshot<DriverSnapshot>(`driver:${driverId}`)
  },
  async clear(driverId: string) {
    await transact<undefined>("readwrite", (store) => store.delete(`driver:${driverId}`))
  },
}

export function formatSnapshotAge(updatedAt: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - updatedAt) / 60_000))
  if (minutes < 1) return "hace menos de un minuto"
  if (minutes === 1) return "hace 1 minuto"
  if (minutes < 60) return `hace ${minutes} minutos`
  const hours = Math.floor(minutes / 60)
  return hours === 1 ? "hace 1 hora" : `hace ${hours} horas`
}
