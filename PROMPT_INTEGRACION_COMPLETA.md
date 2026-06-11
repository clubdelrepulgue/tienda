
# PROMPT: Integrar Frontend + Backend Supabase -- Sistema de Pedidos de Comida

## CONTEXTO DEL PROYECTO

Este es un sistema de pedidos online para UN comercio de comida (single-tenant). Stack: Next.js 16, React 19, Tailwind CSS v4, Zustand, Supabase (auth + DB + realtime), shadcn/ui, Sonner para toasts. El proyecto tiene todo el UI ya construido con datos mock (lib/mock-data.ts), y el esquema SQL listo en scripts/001_schema.sql y scripts/002_harden.sql. Tu trabajo es conectar el frontend existente al backend Supabase sin romper el diseno visual actual.

---

## ARQUITECTURA ACTUAL

### Stack y dependencias ya instaladas
- next@16.1.6, react@19.2.4, zustand@5.0.3, swr@2.3.3
- @supabase/supabase-js@2.49.4, @supabase/ssr@0.6.1
- sonner, lucide-react, shadcn/ui completo
- Fonts: Inter (body), Space Grotesk (headings) via next/font/google

### Estructura de archivos existente
```
app/
  layout.tsx              -- Root layout (Inter + Space_Grotesk, Sonner Toaster)
  globals.css             -- Dark theme con design tokens oklch, TW v4
  page.tsx                -- Storefront: menu publico (usa mock-data)
  checkout/page.tsx       -- Checkout: formulario + resumen (solo toast, no graba en DB)
  admin/
    layout.tsx            -- Sidebar con nav (Dashboard, Orders, Products, Modifiers, Branches)
    page.tsx              -- Dashboard con stats (usa mockOrders)
    orders/page.tsx       -- Kanban 4 columnas: new/preparing/ready/delivered (usa mockOrders, useState local)
    products/page.tsx     -- Tabla CRUD productos (usa mockProducts, useState local)
    modifiers/page.tsx    -- Cards CRUD modifier groups + options (usa mockGroups, useState local)
    branches/page.tsx     -- Cards sucursales con toggle open/close (usa mockBranches, useState local)

components/
  storefront/
    header.tsx            -- Header con logo "BLAZR", ubicacion, boton carrito
    category-tabs.tsx     -- Tabs horizontales scrolleables de categorias
    product-grid.tsx      -- Grid agrupado por categoria con ProductCard
    product-card.tsx      -- Card de producto con imagen, nombre, precio, boton quick-add
    product-modal.tsx     -- Dialog con imagen, modifiers (radio/checkbox), quantity, add to cart
    cart-sheet.tsx        -- Sheet lateral con items del carrito, qty +/-, boton "Continue to Checkout"
    floating-cart.tsx     -- Boton flotante "View Cart" con total

lib/
  types.ts                -- Category, Product, ModifierGroup, ModifierOption, CartItem, CartItemModifier, Order, OrderStatus, Branch, DeliveryMethod, PaymentMethod
  store.ts                -- Zustand: useCartStore (items, addItem, removeItem, updateQty, clearCart, totalPrice, totalItems)
  mock-data.ts            -- categories[], products[], modifierGroups[], mockOrders[], branches[]
  utils.ts                -- cn() helper
  supabase/
    client.ts             -- createBrowserClient (existe pero nadie lo usa)
    server.ts             -- createServerClient con cookies (existe pero nadie lo usa)
    middleware.ts          -- updateSession con guard (skip si no hay env vars)

middleware.ts             -- Llama a updateSession, matcher ignora _next y assets

scripts/
  001_schema.sql          -- Tablas: sucursales, categorias, productos, modifier_groups, modifier_options, producto_modifier_groups, admin_users, order_counters, orders, order_items. RLS habilitado.
  002_harden.sql          -- Funciones: is_admin(), next_order_number(), current_order_token(). Triggers: auto order_number, status timestamps. RLS policies. Realtime para orders.
```

### Esquema de base de datos (ya aplicado en Supabase)

```sql
-- sucursales: id(uuid), nombre, direccion, zonas_delivery(text[]), is_open(bool), created_at
-- categorias: id(uuid), nombre, slug(unique), orden(int), created_at
-- productos: id(uuid), categoria_id(fk), nombre, descripcion, precio(numeric), image_url, activo(bool), created_at
-- modifier_groups: id(uuid), nombre, required(bool), min_sel(int), max_sel(int), orden(int), created_at
-- modifier_options: id(uuid), group_id(fk), nombre, precio_extra(numeric), activo(bool), orden(int), created_at
-- producto_modifier_groups: producto_id(fk), group_id(fk) -- many-to-many
-- admin_users: id(uuid), user_id(uuid unique), role(owner|admin|operator), created_at
-- order_counters: id(int=1), last_number(bigint) -- single row
-- orders: id(uuid), sucursal_id(fk), user_id, customer_name, customer_phone, fulfillment_type(delivery|pickup), address_text, notes, status(new|accepted|preparing|ready|delivered|cancelled), payment_method(mercadopago|cash), subtotal, delivery_fee, total, order_number(bigint auto), public_tracking_token(uuid auto), accepted_at, preparing_at, ready_at, delivered_at, cancelled_at, created_at
-- order_items: id(uuid), order_id(fk), producto_id(fk), nombre_snapshot, precio_unit, qty, modifiers_json(jsonb), total
```

### RLS (ya aplicado)
- Catalogo (categorias, productos, modifiers, sucursales): SELECT publico, INSERT/UPDATE/DELETE solo is_admin()
- orders: INSERT publico (guest checkout), SELECT por is_admin() o por tracking token (current_order_token()), UPDATE/DELETE solo admin
- order_items: INSERT publico, SELECT por admin o via join con order tracking token, UPDATE/DELETE admin
- admin_users: SELECT solo tu propia fila, mutaciones solo admin
- Funcion is_admin() chequea auth.uid() en admin_users
- Funcion current_order_token() lee current_setting('app.order_token')
- Trigger auto-asigna order_number secuencial al insertar
- Trigger auto-asigna timestamps (accepted_at, preparing_at, etc) al cambiar status
- Realtime habilitado para tabla orders

### Tipos TypeScript actuales (lib/types.ts)
```ts
OrderStatus = "new" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled"
DeliveryMethod = "delivery" | "pickup"
PaymentMethod = "mercadopago" | "cash"
Order { id, orderNumber?, trackingToken?, customerName, customerPhone, address, deliveryNotes, deliveryMethod, paymentMethod, items: CartItem[], subtotal, deliveryFee, total, status, createdAt, acceptedAt?, preparingAt?, readyAt?, deliveredAt?, cancelledAt?, branchId }
CartItem { id, productId, name, image, price, quantity, modifiers: CartItemModifier[] }
CartItemModifier { groupId, groupName, optionId, optionName, price }
```

---

## LO QUE DEBES CONSTRUIR (en orden)

### FASE 1: Capa de datos -- Server Actions + Queries

Crea `lib/supabase/queries.ts` con funciones async que lean de Supabase:

```
getCategories()      -- categorias ordenadas por "orden"
getProducts()        -- productos activos con sus modifier group IDs (via producto_modifier_groups)
getModifierGroups()  -- modifier_groups con sus modifier_options nested
getBranches()        -- sucursales
getOrders()          -- orders con order_items, para admin
getOrderByToken(token: string) -- order + items usando tracking token
```

Crea `app/actions.ts` (Server Actions con "use server") con:

```
createOrder(formData)       -- inserta en orders + order_items, retorna { orderId, trackingToken, orderNumber }
updateOrderStatus(orderId, newStatus)  -- update orders.status (admin only)
createProduct(data)         -- insert en productos
updateProduct(id, data)     -- update productos
toggleProductActive(id)     -- toggle activo
createCategory(data)        -- insert en categorias
createModifierGroup(data)   -- insert modifier_groups + modifier_options + producto_modifier_groups
updateModifierGroup(id, data)
createBranch(data)          -- insert sucursales
updateBranch(id, data)
toggleBranchOpen(id)
```

Cada server action debe crear el Supabase server client via `createClient()` de `lib/supabase/server.ts`.

### FASE 2: Storefront conectado a datos reales

**app/page.tsx**: Convertir a Server Component (RSC). Fetch categorias, productos y modifier groups desde Supabase en el server. Pasar como props a un nuevo client component `components/storefront/storefront-shell.tsx` que contenga toda la logica de estado actual (activeCategory, selectedProduct, productModalOpen, cartOpen). Mostrar skeleton/loading mientras carga. Si no hay productos, mostrar estado vacio.

**components/storefront/product-modal.tsx**: En vez de `import { modifierGroups } from "@/lib/mock-data"`, recibir `allModifierGroups` como prop desde el parent.

**app/checkout/page.tsx**: El boton "Place Order" debe llamar al server action `createOrder()`. Enviar: customer_name, customer_phone, fulfillment_type, address_text, notes, payment_method, sucursal_id (por ahora hardcodear la primera sucursal abierta o dejar que el usuario elija), items (mapear CartItem[] a order_items con nombre_snapshot, precio_unit, qty, modifiers_json). Al recibir respuesta exitosa con trackingToken, redirigir a `/order/[trackingToken]`.

### FASE 3: Pagina de tracking del pedido

Crear `app/order/[token]/page.tsx`: Server component que recibe el token de la URL, hace `getOrderByToken(token)` seteando `app.order_token` en la sesion de Supabase. Muestra: order_number, status actual con visual stepper (new -> accepted -> preparing -> ready -> delivered), items del pedido, total, y metodo de entrega/pago. El status se actualiza en realtime via Supabase Realtime subscription (client component hijo). Usar colores del tema existente para cada status.

### FASE 4: Admin Auth

Crear `app/admin/login/page.tsx`: Formulario de login con email + password usando Supabase Auth (signInWithPassword). Despues de login exitoso, verificar que el user esta en admin_users. Si no, mostrar error "No tienes acceso al panel de administracion". Si si, redirect a /admin.

**middleware.ts**: Para rutas /admin/* (excepto /admin/login), verificar que hay sesion Supabase activa. Si no, redirect a /admin/login. Si hay sesion pero el user no esta en admin_users, redirect a /admin/login con error.

**app/admin/layout.tsx**: Agregar boton "Sign Out" en el sidebar que llame a supabase.auth.signOut() y redirigir a /admin/login.

### FASE 5: Admin CRUD conectado a Supabase

**app/admin/products/page.tsx**: Reemplazar `useState(mockProducts)` por SWR que fetchea productos reales. Los botones Create/Edit/Toggle llaman a los server actions correspondientes. Despues de cada mutacion, hacer `mutate()` de SWR para refrescar. Las categorias para el select se cargan desde Supabase tambien.

**app/admin/modifiers/page.tsx**: Igual que products. SWR para cargar modifier_groups con sus options. Create/Edit llaman server actions. Refrescar con mutate().

**app/admin/branches/page.tsx**: Igual. SWR + server actions. El boton "Add Branch" debe abrir un dialog real (como products), no "coming soon".

**app/admin/page.tsx (Dashboard)**: Reemplazar mockOrders por datos reales. Calcular stats (revenue, total orders, active, avg) desde los orders del dia actual. Cargar via SWR.

### FASE 6: Admin Orders en Realtime

**app/admin/orders/page.tsx**: 
1. Agregar columna "accepted" al kanban (entre new y preparing). Total 5 columnas activas + "cancelled" como seccion colapsable.
2. Cargar orders reales con SWR initial fetch.
3. Suscribirse a Supabase Realtime (`supabase.channel('orders').on('postgres_changes', ...)`) para INSERT y UPDATE en tabla orders.
4. Cuando llega un INSERT (pedido nuevo): agregar a la columna "new", reproducir sonido de notificacion y mostrar toast "Nuevo pedido #X".
5. Boton "Next" llama al server action `updateOrderStatus(id, nextStatus)`. La columna se actualiza via realtime (optimistic update tambien).
6. El flujo de estados es: new -> accepted -> preparing -> ready -> delivered. Tambien se puede cancelar desde cualquier estado (boton secundario "Cancel").
7. Cada card muestra: order_number, nombre cliente, telefono, items, total, metodo delivery/pickup, direccion si aplica, tiempo transcurrido desde createdAt.

### FASE 7: Limpieza

- Eliminar `lib/mock-data.ts` completamente. Ningun archivo debe importarlo.
- Verificar que lib/types.ts coincide con lo que retornan las queries (adaptar si es necesario mapear de snake_case a camelCase).
- Agregar loading skeletons (usando `<Skeleton />` de shadcn) en: storefront product grid, admin tables, admin dashboard stats.
- Asegurar que todo funciona sin Supabase configurado mostrando un mensaje tipo "Configure Supabase to get started" en vez de crashear.

---

## REGLAS IMPORTANTES

1. **No cambies el diseno visual.** Los colores, tipografia, spacing, border-radius ya estan perfectos. Solo conecta datos.
2. **Snake_case en DB, camelCase en TS.** Las queries deben mapear: `customer_name` -> `customerName`, `created_at` -> `createdAt`, etc.
3. **Usa el Supabase client correcto:** `lib/supabase/server.ts` para Server Components y Server Actions, `lib/supabase/client.ts` para client-side (realtime subscriptions).
4. **Server Actions para mutaciones.** Nunca mutes datos directamente desde client components. Siempre via server actions en `app/actions.ts`.
5. **SWR para data fetching en client components admin.** No uses useEffect para fetches. Usa SWR con un fetcher que llame a un route handler o directamente revalide via server action.
6. **Realtime solo para orders.** No necesitas realtime para productos, categorias, etc. Solo orders en admin/orders y en la pagina de tracking.
7. **Guest checkout.** Los clientes NO necesitan cuenta. Hacen pedidos como anonimos. Solo los admins se loguean.
8. **Un deploy = una empresa.** No hay multi-tenancy. No existe tabla empresas ni empresa_id.
9. **Sonner para toasts.** Usa `toast.success()`, `toast.error()`, etc. Ya esta configurado globalmente.
10. **Zustand solo para el carrito.** El carrito del storefront sigue en Zustand (client-side). No se persiste en DB hasta el checkout.
11. **Images:** Los productos usan `image_url` en DB. Por ahora pueden seguir apuntando a `/images/*.jpg` que ya existen. El CRUD de productos no necesita upload de imagenes en esta fase.
12. **No toques:** globals.css, layout.tsx (root), components/ui/*, lib/utils.ts, lib/store.ts (cart).

---

## VARIABLES DE ENTORNO NECESARIAS
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Ya estan configuradas como env vars del proyecto. El middleware ya tiene un guard que hace skip si no existen.

---

## SEED DATA

Despues de crear todo, genera un script `scripts/003_seed.sql` que inserte datos de ejemplo que coincidan con lo que hay en mock-data.ts actual:
- 4 categorias (Burgers, Chicken, Sides, Drinks)
- 10 productos con sus relaciones a modifier_groups
- 4 modifier groups con sus options
- 3 sucursales
- 1 admin_user (para el primer usuario que se registre)

Esto permite que la app funcione inmediatamente despues de correr las migraciones + seed.
