-- ============================================================
-- SCHEMA  –  Single-tenant food ordering system
-- ============================================================
-- One Supabase project = one empresa. No empresa_id needed.
-- ============================================================

-- 0. Extensions
create extension if not exists pgcrypto;


-- 1. Sucursales (branches)
create table if not exists public.sucursales (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  zonas_delivery text[] default '{}',
  is_open boolean default true,
  created_at timestamptz default now()
);
alter table public.sucursales enable row level security;


-- 2. Categorias
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  orden int default 0,
  created_at timestamptz default now()
);
alter table public.categorias enable row level security;
create index if not exists idx_categorias_orden on public.categorias(orden);


-- 3. Productos
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  nombre text not null,
  descripcion text default '',
  precio numeric(10,2) not null default 0,
  image_url text default '',
  activo boolean default true,
  created_at timestamptz default now()
);
alter table public.productos enable row level security;
create index if not exists idx_productos_categoria on public.productos(categoria_id);


-- 4. Modifier Groups
create table if not exists public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  required boolean default false,
  min_sel int default 0,
  max_sel int default 5,
  orden int default 0,
  created_at timestamptz default now(),
  constraint chk_mg_min_sel check (min_sel >= 0),
  constraint chk_mg_max_sel check (max_sel >= min_sel),
  constraint chk_mg_max_sel_reasonable check (max_sel <= 50)
);
alter table public.modifier_groups enable row level security;


-- 5. Modifier Options
create table if not exists public.modifier_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  nombre text not null,
  precio_extra numeric(10,2) default 0,
  activo boolean default true,
  orden int default 0,
  created_at timestamptz default now()
);
alter table public.modifier_options enable row level security;
create index if not exists idx_modifier_options_group on public.modifier_options(group_id);


-- 6. Producto-ModifierGroup (many-to-many)
create table if not exists public.producto_modifier_groups (
  producto_id uuid not null references public.productos(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  primary key (producto_id, group_id)
);
alter table public.producto_modifier_groups enable row level security;
create index if not exists idx_pmg_group on public.producto_modifier_groups(group_id);


-- 7. Admin users (links Supabase Auth users to admin roles)
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null default 'admin' check (role in ('owner','admin','operator')),
  created_at timestamptz default now()
);
alter table public.admin_users enable row level security;


-- 8. Order counter (single row, atomic sequential numbers)
create table if not exists public.order_counters (
  id int primary key default 1 check (id = 1),
  last_number bigint not null default 0
);
alter table public.order_counters enable row level security;

-- Seed the single counter row
insert into public.order_counters (id, last_number)
values (1, 0)
on conflict (id) do nothing;


-- 9. Orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  sucursal_id uuid references public.sucursales(id),
  user_id uuid,
  customer_name text not null,
  customer_phone text not null default '',
  fulfillment_type text not null default 'delivery'
    check (fulfillment_type in ('delivery','pickup')),
  address_text text default '',
  notes text default '',
  status text not null default 'new'
    check (status in ('new','accepted','preparing','ready','delivered','cancelled')),
  payment_method text default 'cash'
    check (payment_method in ('mercadopago','cash')),
  subtotal numeric(10,2) default 0,
  delivery_fee numeric(10,2) default 0,
  total numeric(10,2) default 0,
  order_number bigint,
  public_tracking_token uuid not null default gen_random_uuid(),
  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);
alter table public.orders enable row level security;
create index if not exists idx_orders_status_created on public.orders(status, created_at desc);
create index if not exists idx_orders_tracking_token on public.orders(public_tracking_token);


-- 10. Order Items
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  producto_id uuid references public.productos(id),
  nombre_snapshot text not null,
  precio_unit numeric(10,2) not null default 0,
  qty int not null default 1,
  modifiers_json jsonb default '[]',
  total numeric(10,2) not null default 0
);
alter table public.order_items enable row level security;
create index if not exists idx_order_items_order on public.order_items(order_id);
