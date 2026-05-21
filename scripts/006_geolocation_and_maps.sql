-- 006_geolocation_and_maps.sql
-- Geolocalización, coordenadas para sucursales, pedidos y tracking en tiempo real
-- Ejecutar este script en el SQL Editor de Supabase

-- ============================================
-- AGREGAR COORDENADAS A SUCURSALES
-- ============================================
do $$
begin
    -- Coordenadas de la sucursal
    if not exists (select 1 from information_schema.columns where table_name = 'sucursales' and column_name = 'lat') then
        alter table sucursales add column lat numeric(10,8);
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'sucursales' and column_name = 'lng') then
        alter table sucursales add column lng numeric(11,8);
    end if;
    
    -- Radio de cobertura en km (para búsqueda rápida sin polígonos complejos)
    if not exists (select 1 from information_schema.columns where table_name = 'sucursales' and column_name = 'coverage_radius_km') then
        alter table sucursales add column coverage_radius_km numeric(5,2) default 5.0;
    end if;
    
    raise notice '✅ Columnas de coordenadas agregadas a sucursales';
exception when others then
    raise notice 'Error en sucursales: %', sqlerrm;
end $$;

-- ============================================
-- AGREGAR COORDENADAS A ORDERS
-- ============================================
do $$
begin
    -- Coordenadas exactas del cliente
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'address_lat') then
        alter table orders add column address_lat numeric(10,8);
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'address_lng') then
        alter table orders add column address_lng numeric(11,8);
    end if;
    
    -- Para guardar la dirección formateada por Google
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'address_formatted') then
        alter table orders add column address_formatted text;
    end if;
    
    raise notice '✅ Columnas de coordenadas agregadas a orders';
exception when others then
    raise notice 'Error en orders: %', sqlerrm;
end $$;

-- ============================================
-- TABLA DE TRACKING DE REPARTIDORES (histórico)
-- ============================================
create table if not exists driver_location_history (
    id uuid primary key default gen_random_uuid(),
    driver_id uuid not null references drivers(id) on delete cascade,
    lat numeric(10,8) not null,
    lng numeric(11,8) not null,
    accuracy numeric(8,2), -- precisión en metros
    speed numeric(6,2), -- velocidad en km/h
    heading numeric(5,2), -- dirección en grados
    order_id uuid references orders(id) on delete set null, -- pedido activo si existe
    created_at timestamptz default now()
);

comment on table driver_location_history is 'Histórico de ubicaciones de repartidores para tracking y análisis';

do $$
begin
    alter table driver_location_history enable row level security;
    
    drop policy if exists "Driver location history admin view" on driver_location_history;
    drop policy if exists "Driver location self insert" on driver_location_history;
    drop policy if exists "Driver location view by order" on driver_location_history;
    
    -- Admin puede ver todo
    create policy "Driver location history admin view"
        on driver_location_history for select
        using (is_admin());
    
    -- Driver puede insertar sus propias ubicaciones (identificado por driver_id)
    create policy "Driver location self insert"
        on driver_location_history for insert
        with check (
        -- Permite insert si el driver_id corresponde al user_id en la tabla drivers
        exists (
            select 1 from drivers 
            where drivers.id = driver_location_history.driver_id 
            and drivers.user_id = auth.uid()
        )
        or is_admin()
    );
    
    -- Cliente puede ver ubicaciones de su pedido
    create policy "Driver location view by order"
        on driver_location_history for select
        using (
            exists (
                select 1 from orders 
                where orders.id = driver_location_history.order_id 
                and orders.public_tracking_token = current_setting('app.order_token', true)::uuid
            )
        );
    
    raise notice '✅ RLS configurado para driver_location_history';
exception when others then
    raise notice 'Error en RLS driver_location_history: %', sqlerrm;
end $$;

-- Índice para queries de ubicación reciente
 create index if not exists idx_driver_location_driver_time on driver_location_history(driver_id, created_at desc);
create index if not exists idx_driver_location_order on driver_location_history(order_id, created_at desc);

-- ============================================
-- FUNCIÓN PARA OBTENER UBICACIÓN ACTUAL DEL DRIVER
-- ============================================
create or replace function get_driver_current_location(p_driver_id uuid)
returns table (
    lat numeric,
    lng numeric,
    updated_at timestamptz,
    order_id uuid
) as $$
begin
    -- Primero busca en la tabla drivers (última ubicación conocida)
    -- Luego en el historial si no está actualizada
    return query
    select 
        d.current_location->>'lat'::numeric as lat,
        d.current_location->>'lng'::numeric as lng,
        (d.current_location->>'updated_at')::timestamptz as updated_at,
        o.id as order_id
    from drivers d
    left join orders o on o.driver_id = d.id and o.status in ('ready', 'delivering')
    where d.id = p_driver_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- FUNCIÓN PARA ENCONTRAR ZONA POR COORDENADAS
-- ============================================
create or replace function find_zone_by_coordinates(
    p_lat numeric,
    p_lng numeric,
    p_branch_id uuid default null
)
returns table (
    zone_id uuid,
    zone_name text,
    branch_id uuid,
    delivery_fee numeric,
    min_order_amount numeric,
    estimated_time_min integer
) as $$
begin
    return query
    select 
        dz.id as zone_id,
        dz.name as zone_name,
        dz.sucursal_id as branch_id,
        dz.delivery_fee,
        dz.min_order_amount,
        dz.estimated_time_min
    from delivery_zones dz
    where dz.is_active = true
    and (p_branch_id is null or dz.sucursal_id = p_branch_id)
    -- Verificar si el punto está dentro del polígono de la zona
    and jsonb_array_length(dz.coordinates) > 0
    -- Nota: Para una verificación exacta de punto-en-polígono, 
    -- se recomienda usar PostGIS. Esta versión básica verifica bounding box.
    and p_lat between 
        (select min((c->>'lat')::numeric) from jsonb_array_elements(dz.coordinates) as c)
        and (select max((c->>'lat')::numeric) from jsonb_array_elements(dz.coordinates) as c)
    and p_lng between 
        (select min((c->>'lng')::numeric) from jsonb_array_elements(dz.coordinates) as c)
        and (select max((c->>'lng')::numeric) from jsonb_array_elements(dz.coordinates) as c)
    order by dz.delivery_fee asc
    limit 1;
end;
$$ language plpgsql security definer;

-- ============================================
-- REALTIME PARA DRIVER LOCATION HISTORY
-- ============================================
do $$
begin
    if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and tablename = 'driver_location_history'
    ) then
        alter publication supabase_realtime add table driver_location_history;
        raise notice '✅ Tabla driver_location_history agregada a realtime';
    end if;
exception when others then
    raise notice 'Error configurando realtime: %', sqlerrm;
end $$;

-- ============================================
-- TRIGGER PARA ACTUALIZAR current_location EN DRIVERS
-- ============================================
create or replace function update_driver_current_location()
returns trigger as $$
begin
    -- Actualizar la ubicación actual en la tabla drivers
    update drivers 
    set current_location = jsonb_build_object(
        'lat', new.lat,
        'lng', new.lng,
        'updated_at', new.created_at
    ),
    updated_at = new.created_at
    where id = new.driver_id;
    
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists tr_update_driver_location on driver_location_history;
create trigger tr_update_driver_location
    after insert on driver_location_history
    for each row
    execute function update_driver_current_location();

do $$
begin
    raise notice '✅ Script 006_geolocation_and_maps completado exitosamente!';
end $$;
