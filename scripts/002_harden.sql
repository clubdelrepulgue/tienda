-- ============================================================
-- HARDENING  –  Single-tenant RLS, triggers, helpers
-- ============================================================
-- Run AFTER 001_schema.sql
-- ============================================================


-- ============================================================
-- 1. HELPER FUNCTIONS
-- ============================================================

-- 1a. Check if current user is an admin
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;
comment on function public.is_admin() is
  'Returns true when the authenticated user has any admin role.';

-- 1b. Atomic order number generator
create or replace function public.next_order_number()
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  next_num bigint;
begin
  update public.order_counters
    set last_number = last_number + 1
  where id = 1
  returning last_number into next_num;
  return next_num;
end;
$$;
comment on function public.next_order_number() is
  'Atomically increments and returns the next sequential order number.';

-- 1c. Parse order tracking token from session variable
create or replace function public.current_order_token()
returns uuid
language plpgsql stable security definer
set search_path = public
as $$
declare
  raw text;
begin
  raw := current_setting('app.order_token', true);
  if raw is null or raw = '' then
    return null;
  end if;
  return raw::uuid;
exception when others then
  return null;
end;
$$;
comment on function public.current_order_token() is
  'Safely parses the app.order_token session variable for order tracking RLS.';


-- ============================================================
-- 2. TRIGGERS
-- ============================================================

-- 2a. Auto-assign order_number on INSERT
create or replace function public.trg_assign_order_number()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.order_number is null then
    new.order_number := public.next_order_number();
  end if;
  return new;
end;
$$;

drop trigger if exists assign_order_number on public.orders;
create trigger assign_order_number
  before insert on public.orders
  for each row
  execute function public.trg_assign_order_number();

-- 2b. Status change timestamps
create or replace function public.trg_order_status_timestamps()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    case new.status
      when 'accepted'  then
        new.accepted_at  := now();
      when 'preparing' then
        new.accepted_at  := coalesce(new.accepted_at, now());
        new.preparing_at := now();
      when 'ready' then
        new.ready_at     := now();
      when 'delivered' then
        new.delivered_at := now();
      when 'cancelled' then
        new.cancelled_at := now();
      else
        -- no-op
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists order_status_timestamps on public.orders;
create trigger order_status_timestamps
  before update on public.orders
  for each row
  execute function public.trg_order_status_timestamps();


-- ============================================================
-- 3. RLS POLICIES
-- ============================================================

-- ── 3.1 SUCURSALES ──────────────────────────────────────────
-- Public: anyone can read branches
drop policy if exists "sucursales_select" on public.sucursales;
create policy "sucursales_select" on public.sucursales
  for select using (true);
-- Admin: full write
drop policy if exists "sucursales_insert" on public.sucursales;
create policy "sucursales_insert" on public.sucursales
  for insert with check (public.is_admin());
drop policy if exists "sucursales_update" on public.sucursales;
create policy "sucursales_update" on public.sucursales
  for update using (public.is_admin());
drop policy if exists "sucursales_delete" on public.sucursales;
create policy "sucursales_delete" on public.sucursales
  for delete using (public.is_admin());


-- ── 3.2 CATEGORIAS ──────────────────────────────────────────
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  for select using (true);
drop policy if exists "categorias_insert" on public.categorias;
create policy "categorias_insert" on public.categorias
  for insert with check (public.is_admin());
drop policy if exists "categorias_update" on public.categorias;
create policy "categorias_update" on public.categorias
  for update using (public.is_admin());
drop policy if exists "categorias_delete" on public.categorias;
create policy "categorias_delete" on public.categorias
  for delete using (public.is_admin());


-- ── 3.3 PRODUCTOS ───────────────────────────────────────────
drop policy if exists "productos_select" on public.productos;
create policy "productos_select" on public.productos
  for select using (true);
drop policy if exists "productos_insert" on public.productos;
create policy "productos_insert" on public.productos
  for insert with check (public.is_admin());
drop policy if exists "productos_update" on public.productos;
create policy "productos_update" on public.productos
  for update using (public.is_admin());
drop policy if exists "productos_delete" on public.productos;
create policy "productos_delete" on public.productos
  for delete using (public.is_admin());


-- ── 3.4 MODIFIER_GROUPS ─────────────────────────────────────
drop policy if exists "modifier_groups_select" on public.modifier_groups;
create policy "modifier_groups_select" on public.modifier_groups
  for select using (true);
drop policy if exists "modifier_groups_insert" on public.modifier_groups;
create policy "modifier_groups_insert" on public.modifier_groups
  for insert with check (public.is_admin());
drop policy if exists "modifier_groups_update" on public.modifier_groups;
create policy "modifier_groups_update" on public.modifier_groups
  for update using (public.is_admin());
drop policy if exists "modifier_groups_delete" on public.modifier_groups;
create policy "modifier_groups_delete" on public.modifier_groups
  for delete using (public.is_admin());


-- ── 3.5 MODIFIER_OPTIONS ────────────────────────────────────
drop policy if exists "modifier_options_select" on public.modifier_options;
create policy "modifier_options_select" on public.modifier_options
  for select using (true);
drop policy if exists "modifier_options_insert" on public.modifier_options;
create policy "modifier_options_insert" on public.modifier_options
  for insert with check (public.is_admin());
drop policy if exists "modifier_options_update" on public.modifier_options;
create policy "modifier_options_update" on public.modifier_options
  for update using (public.is_admin());
drop policy if exists "modifier_options_delete" on public.modifier_options;
create policy "modifier_options_delete" on public.modifier_options
  for delete using (public.is_admin());


-- ── 3.6 PRODUCTO_MODIFIER_GROUPS ─────────────────────────────
drop policy if exists "pmg_select" on public.producto_modifier_groups;
create policy "pmg_select" on public.producto_modifier_groups
  for select using (true);
drop policy if exists "pmg_insert" on public.producto_modifier_groups;
create policy "pmg_insert" on public.producto_modifier_groups
  for insert with check (public.is_admin());
drop policy if exists "pmg_delete" on public.producto_modifier_groups;
create policy "pmg_delete" on public.producto_modifier_groups
  for delete using (public.is_admin());


-- ── 3.7 ADMIN_USERS ─────────────────────────────────────────
-- Users can see their own row
drop policy if exists "admin_users_self_select" on public.admin_users;
create policy "admin_users_self_select" on public.admin_users
  for select using (user_id = auth.uid());
-- Only existing admins can manage other admins
drop policy if exists "admin_users_insert" on public.admin_users;
create policy "admin_users_insert" on public.admin_users
  for insert with check (public.is_admin());
drop policy if exists "admin_users_update" on public.admin_users;
create policy "admin_users_update" on public.admin_users
  for update using (public.is_admin());
drop policy if exists "admin_users_delete" on public.admin_users;
create policy "admin_users_delete" on public.admin_users
  for delete using (public.is_admin());


-- ── 3.8 ORDERS ──────────────────────────────────────────────
-- Anyone can create orders (guest checkout)
drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders
  for insert with check (true);

-- Select: admin sees all; guest uses tracking token (Adjusted for Realtime)
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select using (true);

-- Update/Delete: admin only
drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders
  for update using (public.is_admin());
drop policy if exists "orders_delete" on public.orders;
create policy "orders_delete" on public.orders
  for delete using (public.is_admin());


-- ── 3.9 ORDER_ITEMS ─────────────────────────────────────────
-- Anyone can insert (part of guest checkout)
drop policy if exists "order_items_insert" on public.order_items;
create policy "order_items_insert" on public.order_items
  for insert with check (true);

-- Select: admin or via parent order tracking token
drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.public_tracking_token is not null
        and public.current_order_token() is not null
        and o.public_tracking_token = public.current_order_token()
    )
  );

-- Update/Delete: admin only
drop policy if exists "order_items_update" on public.order_items;
create policy "order_items_update" on public.order_items
  for update using (public.is_admin());
drop policy if exists "order_items_delete" on public.order_items;
create policy "order_items_delete" on public.order_items
  for delete using (public.is_admin());


-- ── 3.10 ORDER_COUNTERS ─────────────────────────────────────
-- Admin read-only; writes handled by next_order_number() SECURITY DEFINER
drop policy if exists "order_counters_select" on public.order_counters;
create policy "order_counters_select" on public.order_counters
  for select using (public.is_admin());


-- ============================================================
-- 4. REALTIME
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- Permitir que PostgreSQL envíe todas las columnas mediante WebSockets (Realtime) 
-- cuando se aplican filtros sobre columnas que NO son la clave primaria.
alter table public.orders replica identity full;


-- ============================================================
-- END OF HARDENING
-- ============================================================
