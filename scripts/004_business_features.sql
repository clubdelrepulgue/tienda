-- 004_business_features.sql
-- Sistema de cupones, zonas de delivery, repartidores, upsells
-- Ejecutar este script en el SQL Editor de Supabase

-- ============================================
-- COUPONS (Cupones de descuento)
-- ============================================
create table if not exists coupons (
    id uuid primary key default gen_random_uuid(),
    code text unique not null,
    description text,
    discount_type text not null check (discount_type in ('percentage', 'fixed_amount')),
    discount_value numeric(10,2) not null,
    min_order_amount numeric(10,2) default 0,
    max_discount_amount numeric(10,2),
    usage_limit integer,
    usage_count integer default 0,
    per_user_limit integer default 1,
    valid_from timestamptz not null default now(),
    valid_until timestamptz,
    applicable_to text[] default '{}',
    excluded_products text[] default '{}',
    is_active boolean default true,
    created_at timestamptz default now()
);

comment on table coupons is 'Cupones de descuento para pedidos';

-- RLS para coupons (solo crear si no existen)
do $$
begin
    -- Habilitar RLS
    alter table coupons enable row level security;
    
    -- Eliminar policies existentes para evitar duplicados
    drop policy if exists "Coupons visible to public" on coupons;
    drop policy if exists "Coupons admin full access" on coupons;
    
    -- Crear policies
    create policy "Coupons visible to public"
        on coupons for select
        using (is_active = true and (valid_until is null or valid_until > now()));
    
    create policy "Coupons admin full access"
        on coupons for all
        using (is_admin())
        with check (is_admin());
exception when others then
    raise notice 'Error en policies de coupons: %', sqlerrm;
end $$;

-- ============================================
-- DELIVERY ZONES (Zonas de delivery con costos)
-- ============================================
create table if not exists delivery_zones (
    id uuid primary key default gen_random_uuid(),
    sucursal_id uuid references sucursales(id) on delete cascade,
    name text not null,
    color text default '#3b82f6',
    coordinates jsonb not null default '[]',
    delivery_fee numeric(10,2) not null default 0,
    min_order_amount numeric(10,2) default 0,
    estimated_time_min integer,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

comment on table delivery_zones is 'Zonas geográficas de delivery con costos variables';

do $$
begin
    alter table delivery_zones enable row level security;
    
    drop policy if exists "Delivery zones public read" on delivery_zones;
    drop policy if exists "Delivery zones admin full access" on delivery_zones;
    
    create policy "Delivery zones public read"
        on delivery_zones for select
        using (is_active = true);
    
    create policy "Delivery zones admin full access"
        on delivery_zones for all
        using (is_admin())
        with check (is_admin());
exception when others then
    raise notice 'Error en policies de delivery_zones: %', sqlerrm;
end $$;

-- ============================================
-- DRIVERS (Repartidores)
-- ============================================
create table if not exists drivers (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    name text not null,
    phone text not null,
    email text,
    vehicle_type text,
    vehicle_plate text,
    is_active boolean default true,
    is_available boolean default true,
    current_location jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

comment on table drivers is 'Repartidores de delivery';

do $$
begin
    alter table drivers enable row level security;
    
    drop policy if exists "Drivers self read" on drivers;
    drop policy if exists "Drivers admin manage" on drivers;
    
    create policy "Drivers self read"
        on drivers for select
        using (user_id = auth.uid() or is_admin());
    
    create policy "Drivers admin manage"
        on drivers for all
        using (is_admin())
        with check (is_admin());
exception when others then
    raise notice 'Error en policies de drivers: %', sqlerrm;
end $$;

-- ============================================
-- UPSELL RULES (Reglas de upsells inteligentes)
-- ============================================
create table if not exists upsell_rules (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    trigger_product_ids text[] default '{}',
    trigger_category_ids text[] default '{}',
    suggested_product_ids text[] not null,
    message text not null default '¿Te gustaría agregar esto?',
    discount_percentage numeric(5,2) default 0,
    priority integer default 0,
    is_active boolean default true,
    created_at timestamptz default now()
);

comment on table upsell_rules is 'Reglas para sugerencias de productos (upsells)';

do $$
begin
    alter table upsell_rules enable row level security;
    
    drop policy if exists "Upsell rules public read" on upsell_rules;
    drop policy if exists "Upsell rules admin full access" on upsell_rules;
    
    create policy "Upsell rules public read"
        on upsell_rules for select
        using (is_active = true);
    
    create policy "Upsell rules admin full access"
        on upsell_rules for all
        using (is_admin())
        with check (is_admin());
exception when others then
    raise notice 'Error en policies de upsell_rules: %', sqlerrm;
end $$;

-- ============================================
-- MODIFICAR TABLA ORDERS (agregar columnas nuevas)
-- ============================================
do $$
begin
    -- Agregar columnas si no existen
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'coupon_code') then
        alter table orders add column coupon_code text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'coupon_discount') then
        alter table orders add column coupon_discount numeric(10,2) default 0;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'delivery_zone_id') then
        alter table orders add column delivery_zone_id uuid references delivery_zones(id);
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'driver_id') then
        alter table orders add column driver_id uuid references drivers(id);
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'driver_assigned_at') then
        alter table orders add column driver_assigned_at timestamptz;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'driver_notes') then
        alter table orders add column driver_notes text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'pickup_code') then
        alter table orders add column pickup_code text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'order_type') then
        alter table orders add column order_type text default 'online' check (order_type in ('online', 'pos', 'phone'));
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'created_by') then
        alter table orders add column created_by uuid references auth.users(id);
    end if;
    
    raise notice 'Columnas de orders actualizadas';
exception when others then
    raise notice 'Error modificando orders: %', sqlerrm;
end $$;

-- ============================================
-- ORDER STATUS HISTORY
-- ============================================
create table if not exists order_status_history (
    id uuid primary key default gen_random_uuid(),
    order_id uuid references orders(id) on delete cascade,
    status text not null,
    changed_by uuid references auth.users(id),
    changed_by_name text,
    notes text,
    created_at timestamptz default now()
);

comment on table order_status_history is 'Historial de cambios de estado de pedidos';

do $$
begin
    alter table order_status_history enable row level security;
    
    drop policy if exists "Status history viewable" on order_status_history;
    drop policy if exists "Status history admin insert" on order_status_history;
    
    create policy "Status history viewable"
        on order_status_history for select
        using (
            is_admin() or 
            exists (
                select 1 from orders 
                where orders.id = order_status_history.order_id 
                and orders.public_tracking_token = current_setting('app.order_token', true)::uuid
            )
        );
    
    create policy "Status history admin insert"
        on order_status_history for insert
        with check (is_admin());
exception when others then
    raise notice 'Error en policies de order_status_history: %', sqlerrm;
end $$;

-- ============================================
-- TRIGGERS Y FUNCIONES
-- ============================================

-- Función para incrementar uso de cupones (idempotent)
create or replace function increment_coupon_usage()
returns trigger as $$
begin
    if new.coupon_code is not null then
        update coupons 
        set usage_count = usage_count + 1
        where code = new.coupon_code;
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- Eliminar trigger si existe y recrear
drop trigger if exists tr_increment_coupon_usage on orders;
create trigger tr_increment_coupon_usage
    after insert on orders
    for each row
    execute function increment_coupon_usage();

-- Función para log de cambios de estado
create or replace function log_order_status_change()
returns trigger as $$
begin
    if old.status is distinct from new.status then
        insert into order_status_history (order_id, status, changed_by, changed_by_name, notes)
        values (
            new.id, 
            new.status, 
            current_setting('app.current_user_id', true)::uuid,
            current_setting('app.current_user_name', true),
            'Status changed from ' || coalesce(old.status, 'null') || ' to ' || new.status
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_log_order_status on orders;
create trigger tr_log_order_status
    after update on orders
    for each row
    when (old.status is distinct from new.status)
    execute function log_order_status_change();

-- ============================================
-- REALTIME (solo agregar tablas que no estén ya)
-- ============================================
do $$
begin
    -- Agregar tabla drivers a realtime si no está
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and tablename = 'drivers'
    ) then
        alter publication supabase_realtime add table drivers;
        raise notice 'Tabla drivers agregada a realtime';
    end if;
    
    -- orders ya debería estar, pero por si acaso verificamos
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and tablename = 'orders'
    ) then
        alter publication supabase_realtime add table orders;
        raise notice 'Tabla orders agregada a realtime';
    end if;
    
    raise notice 'Realtime configurado correctamente';
exception when others then
    raise notice 'Error configurando realtime (puede ser normal): %', sqlerrm;
end $$;

-- ============================================
-- ÍNDICES (idempotent)
-- ============================================
create index if not exists idx_coupons_code on coupons(code);
create index if not exists idx_coupons_active on coupons(is_active, valid_until);
create index if not exists idx_delivery_zones_sucursal on delivery_zones(sucursal_id);
create index if not exists idx_orders_driver on orders(driver_id);
create index if not exists idx_orders_zone on orders(delivery_zone_id);
create index if not exists idx_orders_type on orders(order_type);
create index if not exists idx_order_status_history_order on order_status_history(order_id);

-- ============================================
-- FUNCIONES RPC PARA TRACKING (si no existen)
-- ============================================

-- Función para obtener orden por token
create or replace function get_order_by_token(p_token uuid)
returns setof orders as $$
begin
    return query select * from orders where public_tracking_token = p_token;
end;
$$ language plpgsql security definer;

-- Función para obtener items de orden por token
create or replace function get_order_items_by_token(p_token uuid)
returns setof order_items as $$
begin
    return query 
    select oi.* from order_items oi
    join orders o on o.id = oi.order_id
    where o.public_tracking_token = p_token;
end;
$$ language plpgsql security definer;

do $$
begin
    raise notice '✅ Script completado exitosamente!';
end $$;
