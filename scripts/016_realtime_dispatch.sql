-- 016: Despacho en tiempo real.
--
-- Tres problemas que este script corrige:
--
-- 1. No existía el concepto de "conectado". `is_available` solo indica
--    ocupado/libre (lo setean assignDriver / releaseDriverIfIdle), así que el
--    panel mostraba "Disponible" a repartidores con el celular apagado.
--    Se agregan `last_seen_at` (heartbeat del GPS) e `is_on_shift` (el
--    repartidor entra y sale de turno explícitamente).
--
-- 2. Doble escritura de la ubicación. `updateDriverLocation` hacía UPDATE de
--    drivers.current_location Y un INSERT en driver_location_history; el
--    trigger tr_update_driver_location volvía a escribir current_location a
--    partir de ese insert. Resultado: dos eventos Realtime por posición y, como
--    el insert es fire-and-forget, el trigger podía aterrizar DESPUÉS de un
--    update más nuevo y hacer retroceder el pin. Ahora el trigger solo escribe
--    si la fila entrante es más nueva que la que ya está guardada.
--
-- 3. Realtime de orders no traía `payload.old.driver_id` (replica identity por
--    defecto = solo PK), así que desasignar un pedido no refrescaba el
--    dashboard del repartidor.

-- ─────────────────────────────────────────────────────────────
-- 1. Estado de conexión del repartidor
-- ─────────────────────────────────────────────────────────────
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'drivers' and column_name = 'last_seen_at'
    ) then
        alter table drivers add column last_seen_at timestamptz;
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_name = 'drivers' and column_name = 'is_on_shift'
    ) then
        alter table drivers add column is_on_shift boolean not null default false;
    end if;

    if not exists (
        select 1 from information_schema.columns
        where table_name = 'drivers' and column_name = 'shift_started_at'
    ) then
        alter table drivers add column shift_started_at timestamptz;
    end if;
end $$;

comment on column drivers.last_seen_at is
    'Último ping del repartidor (GPS o heartbeat). Fuente de verdad de "conectado".';
comment on column drivers.is_on_shift is
    'El repartidor entró en turno explícitamente desde su app.';
comment on column drivers.is_available is
    'Ocupado/libre: false mientras tiene un pedido asignado. NO significa conectado.';

create index if not exists idx_drivers_last_seen on drivers(last_seen_at desc)
    where is_active = true;

-- Los repartidores que ya venían reportando posición arrancan con last_seen_at
-- derivado de su última ubicación conocida, para no mostrarlos como
-- "nunca conectados" apenas se aplica la migración.
update drivers
set last_seen_at = (current_location->>'updated_at')::timestamptz
where last_seen_at is null
  and current_location is not null
  and jsonb_typeof(current_location) = 'object'
  and jsonb_exists(current_location, 'updated_at');

-- ─────────────────────────────────────────────────────────────
-- 2. Trigger de ubicación: idempotente y monótono
-- ─────────────────────────────────────────────────────────────
-- Se mantiene el trigger (protege el caso de un insert directo en el historial)
-- pero deja de pisar una posición más nueva con una más vieja.
create or replace function update_driver_current_location()
returns trigger as $$
declare
    existing_at timestamptz;
begin
    select (current_location->>'updated_at')::timestamptz
    into existing_at
    from drivers
    where id = new.driver_id;

    -- Si ya tenemos una posición igual o más nueva, no hacemos nada:
    -- evitamos el UPDATE redundante (y su evento Realtime) y el retroceso del pin.
    if existing_at is not null and existing_at >= new.created_at then
        return new;
    end if;

    update drivers
    set current_location = jsonb_build_object(
            'lat', new.lat,
            'lng', new.lng,
            'accuracy', new.accuracy,
            'heading', new.heading,
            'speed', case when new.speed is not null then new.speed / 3.6 else null end,
            'updated_at', new.created_at
        ),
        last_seen_at = greatest(coalesce(last_seen_at, new.created_at), new.created_at),
        updated_at = new.created_at
    where id = new.driver_id;

    return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- 2b. Escritura atómica de posición
-- ─────────────────────────────────────────────────────────────
-- Un solo round-trip que:
--   * descarta lecturas más viejas que la ya guardada (llegan desordenadas
--     cuando el celular reintenta tras un corte de red),
--   * refresca last_seen_at aunque la posición se descarte (el repartidor
--     sigue conectado, solo que su fix era viejo),
--   * archiva en el historial únicamente cuando se movió de verdad, para no
--     inflar la tabla con el repartidor parado en un semáforo.
create or replace function record_driver_location(
    p_driver_id uuid,
    p_lat numeric,
    p_lng numeric,
    p_accuracy numeric default null,
    p_speed_ms numeric default null,      -- m/s, como lo entrega el navegador
    p_heading numeric default null,
    p_captured_at timestamptz default now(),
    p_min_history_meters numeric default 25
)
returns table (accepted boolean, stale boolean) as $$
declare
    v_existing jsonb;
    v_existing_at timestamptz;
    v_prev_lat numeric;
    v_prev_lng numeric;
    v_moved numeric;
    v_order_id uuid;
begin
    select current_location into v_existing from drivers where id = p_driver_id;

    if not found then
        raise exception 'Repartidor % no encontrado', p_driver_id
            using errcode = 'no_data_found';
    end if;

    v_existing_at := (v_existing->>'updated_at')::timestamptz;

    -- Fix viejo: no pisamos la posición, pero sí confirmamos que sigue vivo.
    if v_existing_at is not null and v_existing_at >= p_captured_at then
        update drivers set last_seen_at = now() where id = p_driver_id;
        return query select false, true;
        return;
    end if;

    update drivers
    set current_location = jsonb_build_object(
            'lat', p_lat,
            'lng', p_lng,
            'accuracy', p_accuracy,
            'heading', p_heading,
            'speed', p_speed_ms,
            'updated_at', p_captured_at
        ),
        last_seen_at = now(),
        updated_at = now()
    where id = p_driver_id;

    -- Historial: solo si se movió lo suficiente respecto del último punto.
    v_prev_lat := (v_existing->>'lat')::numeric;
    v_prev_lng := (v_existing->>'lng')::numeric;

    if v_prev_lat is null or v_prev_lng is null then
        v_moved := p_min_history_meters;  -- primer punto, siempre se archiva
    else
        -- Haversine en metros.
        v_moved := 6371000 * 2 * asin(sqrt(
            power(sin(radians(p_lat - v_prev_lat) / 2), 2) +
            cos(radians(v_prev_lat)) * cos(radians(p_lat)) *
            power(sin(radians(p_lng - v_prev_lng) / 2), 2)
        ));
    end if;

    if v_moved >= p_min_history_meters then
        select id into v_order_id
        from orders
        where driver_id = p_driver_id and status = 'en_route'
        order by en_route_at desc nulls last
        limit 1;

        insert into driver_location_history
            (driver_id, lat, lng, accuracy, speed, heading, order_id, created_at)
        values (
            p_driver_id, p_lat, p_lng, p_accuracy,
            case when p_speed_ms is not null then p_speed_ms * 3.6 else null end,
            p_heading, v_order_id, p_captured_at
        );
    end if;

    return query select true, false;
end;
$$ language plpgsql security definer;

comment on function record_driver_location is
    'Escritura idempotente y monótona de la posición del repartidor. Descarta fixes viejos y archiva en el historial solo movimientos reales.';

-- ─────────────────────────────────────────────────────────────
-- 2c. Turno del repartidor
-- ─────────────────────────────────────────────────────────────
create or replace function set_driver_shift(p_driver_id uuid, p_on_shift boolean)
returns void as $$
begin
    update drivers
    set is_on_shift = p_on_shift,
        shift_started_at = case
            when p_on_shift and not is_on_shift then now()
            when not p_on_shift then null
            else shift_started_at
        end,
        last_seen_at = case when p_on_shift then now() else last_seen_at end,
        updated_at = now()
    where id = p_driver_id;
end;
$$ language plpgsql security definer;

-- Ambas funciones son SECURITY DEFINER y se invocan solo desde el servidor con
-- la service-role key (app/actions.ts). Sin este revoke quedarían expuestas por
-- PostgREST a cualquiera con la anon key, que podría falsear la posición o el
-- turno de un repartidor conociendo su UUID.
revoke all on function record_driver_location(uuid, numeric, numeric, numeric, numeric, numeric, timestamptz, numeric) from public, anon, authenticated;
revoke all on function set_driver_shift(uuid, boolean) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Realtime: payload.old completo en orders
-- ─────────────────────────────────────────────────────────────
-- Sin esto, payload.old solo trae el id y el dashboard del repartidor no se
-- entera cuando le sacan un pedido (compara previousOrder.driver_id).
do $$
begin
    alter table public.orders replica identity full;
    raise notice 'orders: replica identity full';
exception when others then
    raise notice 'No se pudo setear replica identity en orders: %', sqlerrm;
end $$;

-- drivers ya está en la publicación (004), pero lo verificamos igual.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and tablename = 'drivers'
    ) then
        alter publication supabase_realtime add table drivers;
    end if;
exception when others then
    raise notice 'Realtime drivers: %', sqlerrm;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 4. Retención del historial de ubicaciones
-- ─────────────────────────────────────────────────────────────
-- A ~1 punto cada 10 s por repartidor en turno, esta tabla crece rápido y solo
-- se usa para analítica reciente.
create or replace function prune_driver_location_history(p_days integer default 7)
returns integer as $$
declare
    deleted integer;
begin
    delete from driver_location_history
    where created_at < now() - (p_days || ' days')::interval;
    get diagnostics deleted = row_count;
    return deleted;
end;
$$ language plpgsql security definer;

do $$
begin
    raise notice '✅ 016_realtime_dispatch aplicado';
end $$;
