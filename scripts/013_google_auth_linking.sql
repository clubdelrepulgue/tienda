-- 013: Google login (Supabase Auth) ↔ customers linking.
-- Run AFTER scripts/012_customers_and_loyalty.sql.
--
-- The customer key stays the normalized phone; a Google account is a
-- verified pointer to that same record (customers.auth_user_id, added in 012).
-- Orders gain customer_id so account history doesn't depend on how the
-- phone was typed on each order.

-- ─── Phone normalization (must mirror lib/customer.ts) ─────────

create or replace function public.normalize_phone(raw text)
returns text
language sql
immutable
as $$
    with digits as (
        select regexp_replace(coalesce(raw, ''), '\D', '', 'g') as d
    ),
    no_country as (
        select case
            when d like '00598%' then substr(d, 6)
            when d like '598%' and length(d) > 9 then substr(d, 4)
            else d
        end as d
        from digits
    )
    select case when d like '0%' then substr(d, 2) else d end
    from no_country
$$;

-- ─── Orders → customer link ────────────────────────────────────

alter table public.orders
    add column if not exists customer_id uuid references public.customers (id) on delete set null;

create index if not exists orders_customer_id_idx on public.orders (customer_id);

-- Backfill customers from historical orders (so loyalty/history include them),
-- then link every order to its customer.

insert into public.customers (phone, name, last_order_at)
select
    normalize_phone(o.customer_phone) as phone,
    max(o.customer_name) as name,
    max(o.created_at) as last_order_at
from public.orders o
where normalize_phone(o.customer_phone) <> ''
group by normalize_phone(o.customer_phone)
on conflict (phone) do nothing;

update public.orders o
set customer_id = c.id
from public.customers c
where o.customer_id is null
  and normalize_phone(o.customer_phone) = c.phone;

-- ─── RLS: a logged-in customer can read their own data ─────────

drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own"
    on public.customers for select
    to authenticated
    using (auth_user_id = auth.uid());

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
    on public.orders for select
    to authenticated
    using (
        customer_id in (
            select id from public.customers where auth_user_id = auth.uid()
        )
    );

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own"
    on public.order_items for select
    to authenticated
    using (
        order_id in (
            select o.id
            from public.orders o
            join public.customers c on c.id = o.customer_id
            where c.auth_user_id = auth.uid()
        )
    );
