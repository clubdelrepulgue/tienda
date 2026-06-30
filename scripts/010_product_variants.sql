-- ============================================================
-- PRODUCT VARIANTS (sizes / options with their own price)
-- ============================================================
-- A variant REPLACES the product base price (it is NOT an extra
-- like a modifier). Examples: burger "Simple"/"Doble", pizza
-- "32cm"/"50cm". Products without variants keep using productos.precio.
-- Run after 009_en_route_status.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Per-product label for the variant selector (e.g. "Carnes", "Tamaño")
alter table public.productos
  add column if not exists variant_group_label text not null default 'Tamaño';

-- 2. Variants
create table if not exists public.producto_variantes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos(id) on delete cascade,
  nombre text not null,
  precio numeric(10,2) not null default 0,
  activo boolean default true,
  orden int default 0,
  created_at timestamptz default now()
);
alter table public.producto_variantes enable row level security;
create index if not exists idx_producto_variantes_producto
  on public.producto_variantes(producto_id, orden);

-- 3. Snapshot of the chosen variant on each order line
alter table public.order_items
  add column if not exists variante_snapshot text;

-- 4. RLS — public read, branch-scoped writes (mirrors modifier_options)
drop policy if exists "producto_variantes_select" on public.producto_variantes;
create policy "producto_variantes_select" on public.producto_variantes
  for select using (true);

drop policy if exists "producto_variantes_insert" on public.producto_variantes;
create policy "producto_variantes_insert" on public.producto_variantes
  for insert with check (
    exists (
      select 1 from public.productos p
      where p.id = producto_variantes.producto_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  );

drop policy if exists "producto_variantes_update" on public.producto_variantes;
create policy "producto_variantes_update" on public.producto_variantes
  for update using (
    exists (
      select 1 from public.productos p
      where p.id = producto_variantes.producto_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  )
  with check (
    exists (
      select 1 from public.productos p
      where p.id = producto_variantes.producto_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  );

drop policy if exists "producto_variantes_delete" on public.producto_variantes;
create policy "producto_variantes_delete" on public.producto_variantes
  for delete using (
    exists (
      select 1 from public.productos p
      where p.id = producto_variantes.producto_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  );

do $$
begin
  raise notice 'Product variants migration completed';
end $$;
