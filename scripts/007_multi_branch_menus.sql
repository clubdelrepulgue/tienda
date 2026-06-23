-- ============================================================
-- MULTI-BRANCH MENUS
-- One company, multiple branch-owned catalogs and branch-scoped operators.
-- Run after 006_geolocation_and_maps.sql
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Stable slug helper
create or replace function public.slugify(input text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(lower(coalesce(input, 'sucursal')), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'sucursal'
  );
$$;

-- 2. Branch slug and default branch
alter table public.sucursales
  add column if not exists slug text;

insert into public.sucursales (nombre, slug, direccion, is_open)
select 'Sucursal principal', 'sucursal-principal', '', true
where not exists (select 1 from public.sucursales);

update public.sucursales
set slug = public.slugify(nombre)
where slug is null or slug = '';

with ranked as (
  select id, slug, row_number() over (partition by slug order by created_at, id) as rn
  from public.sucursales
)
update public.sucursales s
set slug = ranked.slug || '-' || ranked.rn
from ranked
where s.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_sucursales_slug_unique
  on public.sucursales(slug);

alter table public.sucursales
  alter column slug set not null;

-- 3. Branch ownership for catalog tables
alter table public.categorias
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete cascade;

alter table public.productos
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete cascade;

alter table public.modifier_groups
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete cascade;

alter table public.upsell_rules
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete cascade;

do $$
declare
  default_branch_id uuid;
begin
  select id into default_branch_id
  from public.sucursales
  order by created_at asc
  limit 1;

  update public.categorias set sucursal_id = default_branch_id where sucursal_id is null;
  update public.productos set sucursal_id = default_branch_id where sucursal_id is null;
  update public.modifier_groups set sucursal_id = default_branch_id where sucursal_id is null;
  update public.upsell_rules set sucursal_id = default_branch_id where sucursal_id is null;
  update public.orders set sucursal_id = default_branch_id where sucursal_id is null;
end $$;

alter table public.categorias alter column sucursal_id set not null;
alter table public.productos alter column sucursal_id set not null;
alter table public.modifier_groups alter column sucursal_id set not null;
alter table public.upsell_rules alter column sucursal_id set not null;
alter table public.orders alter column sucursal_id set not null;

-- Replace old global category slug uniqueness with per-branch uniqueness.
alter table public.categorias drop constraint if exists categorias_slug_key;
drop index if exists public.categorias_slug_key;

create unique index if not exists idx_categorias_sucursal_slug_unique
  on public.categorias(sucursal_id, slug);

create index if not exists idx_categorias_sucursal_orden on public.categorias(sucursal_id, orden);
create index if not exists idx_productos_sucursal on public.productos(sucursal_id);
create index if not exists idx_modifier_groups_sucursal on public.modifier_groups(sucursal_id);
create index if not exists idx_upsell_rules_sucursal on public.upsell_rules(sucursal_id);
create index if not exists idx_orders_sucursal_status_created on public.orders(sucursal_id, status, created_at desc);

-- 4. Operator scope
alter table public.admin_users
  add column if not exists sucursal_id uuid references public.sucursales(id) on delete set null;

alter table public.admin_users
  drop constraint if exists admin_users_operator_branch_chk;

alter table public.admin_users
  add constraint admin_users_operator_branch_chk
  check (role <> 'operator' or sucursal_id is not null);

-- 5. Access helpers
create or replace function public.current_admin_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.admin_users where user_id = auth.uid() limit 1;
$$;

create or replace function public.current_admin_sucursal_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select sucursal_id from public.admin_users where user_id = auth.uid() limit 1;
$$;

create or replace function public.is_global_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_sucursal(target_sucursal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and (
        role in ('owner', 'admin')
        or sucursal_id = target_sucursal_id
      )
  );
$$;

-- 6. RLS policies
drop policy if exists "categorias_select" on public.categorias;
create policy "categorias_select" on public.categorias
  for select using (true);

drop policy if exists "categorias_insert" on public.categorias;
create policy "categorias_insert" on public.categorias
  for insert with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "categorias_update" on public.categorias;
create policy "categorias_update" on public.categorias
  for update using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "categorias_delete" on public.categorias;
create policy "categorias_delete" on public.categorias
  for delete using (public.can_access_sucursal(sucursal_id));

drop policy if exists "productos_select" on public.productos;
create policy "productos_select" on public.productos
  for select using (true);

drop policy if exists "productos_insert" on public.productos;
create policy "productos_insert" on public.productos
  for insert with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "productos_update" on public.productos;
create policy "productos_update" on public.productos
  for update using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "productos_delete" on public.productos;
create policy "productos_delete" on public.productos
  for delete using (public.can_access_sucursal(sucursal_id));

drop policy if exists "modifier_groups_select" on public.modifier_groups;
create policy "modifier_groups_select" on public.modifier_groups
  for select using (true);

drop policy if exists "modifier_groups_insert" on public.modifier_groups;
create policy "modifier_groups_insert" on public.modifier_groups
  for insert with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "modifier_groups_update" on public.modifier_groups;
create policy "modifier_groups_update" on public.modifier_groups
  for update using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "modifier_groups_delete" on public.modifier_groups;
create policy "modifier_groups_delete" on public.modifier_groups
  for delete using (public.can_access_sucursal(sucursal_id));

drop policy if exists "modifier_options_select" on public.modifier_options;
create policy "modifier_options_select" on public.modifier_options
  for select using (true);

drop policy if exists "modifier_options_insert" on public.modifier_options;
create policy "modifier_options_insert" on public.modifier_options
  for insert with check (
    exists (
      select 1 from public.modifier_groups mg
      where mg.id = modifier_options.group_id
        and public.can_access_sucursal(mg.sucursal_id)
    )
  );

drop policy if exists "modifier_options_update" on public.modifier_options;
create policy "modifier_options_update" on public.modifier_options
  for update using (
    exists (
      select 1 from public.modifier_groups mg
      where mg.id = modifier_options.group_id
        and public.can_access_sucursal(mg.sucursal_id)
    )
  )
  with check (
    exists (
      select 1 from public.modifier_groups mg
      where mg.id = modifier_options.group_id
        and public.can_access_sucursal(mg.sucursal_id)
    )
  );

drop policy if exists "modifier_options_delete" on public.modifier_options;
create policy "modifier_options_delete" on public.modifier_options
  for delete using (
    exists (
      select 1 from public.modifier_groups mg
      where mg.id = modifier_options.group_id
        and public.can_access_sucursal(mg.sucursal_id)
    )
  );

drop policy if exists "pmg_select" on public.producto_modifier_groups;
create policy "pmg_select" on public.producto_modifier_groups
  for select using (true);

drop policy if exists "pmg_insert" on public.producto_modifier_groups;
create policy "pmg_insert" on public.producto_modifier_groups
  for insert with check (
    exists (
      select 1
      from public.productos p
      join public.modifier_groups mg on mg.id = producto_modifier_groups.group_id
      where p.id = producto_modifier_groups.producto_id
        and p.sucursal_id = mg.sucursal_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  );

drop policy if exists "pmg_delete" on public.producto_modifier_groups;
create policy "pmg_delete" on public.producto_modifier_groups
  for delete using (
    exists (
      select 1 from public.productos p
      where p.id = producto_modifier_groups.producto_id
        and public.can_access_sucursal(p.sucursal_id)
    )
  );

drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select using (
    public.can_access_sucursal(sucursal_id)
    or public_tracking_token = public.current_order_token()
  );

drop policy if exists "orders_update" on public.orders;
create policy "orders_update" on public.orders
  for update using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "orders_delete" on public.orders;
create policy "orders_delete" on public.orders
  for delete using (public.can_access_sucursal(sucursal_id));

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select" on public.order_items
  for select using (
    exists (
      select 1
      from public.orders o
      where o.id = order_items.order_id
        and (
          public.can_access_sucursal(o.sucursal_id)
          or o.public_tracking_token = public.current_order_token()
        )
    )
  );

drop policy if exists "order_items_update" on public.order_items;
create policy "order_items_update" on public.order_items
  for update using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.can_access_sucursal(o.sucursal_id)
    )
  );

drop policy if exists "order_items_delete" on public.order_items;
create policy "order_items_delete" on public.order_items
  for delete using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and public.can_access_sucursal(o.sucursal_id)
    )
  );

drop policy if exists "Delivery zones admin full access" on public.delivery_zones;
create policy "Delivery zones admin full access"
  on public.delivery_zones for all
  using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

drop policy if exists "Upsell rules admin full access" on public.upsell_rules;
create policy "Upsell rules admin full access"
  on public.upsell_rules for all
  using (public.can_access_sucursal(sucursal_id))
  with check (public.can_access_sucursal(sucursal_id));

-- Keep guest order creation open, but only for active branches.
drop policy if exists "orders_insert" on public.orders;
create policy "orders_insert" on public.orders
  for insert with check (
    exists (
      select 1 from public.sucursales s
      where s.id = orders.sucursal_id
        and s.is_open = true
    )
    or public.can_access_sucursal(sucursal_id)
  );

do $$
begin
  raise notice 'Multi-branch menu migration completed';
end $$;
