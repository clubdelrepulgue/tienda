-- 012: Customer identity (no login), per-customer coupon limits and loyalty program.
--
-- Customers are keyed by normalized phone (digits only, no country code).
-- `auth_user_id` stays NULL for now: when social login lands, linking an
-- auth.users row to an existing customer keeps their history and loyalty.

-- ─── Customers ─────────────────────────────────────────────────

create table if not exists public.customers (
    id uuid primary key default gen_random_uuid(),
    phone text not null unique,
    name text,
    auth_user_id uuid references auth.users (id) on delete set null,
    orders_count integer not null default 0,
    loyalty_progress integer not null default 0,
    reward_coupon_code text,
    last_order_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists customers_auth_user_id_idx on public.customers (auth_user_id);

alter table public.customers enable row level security;

-- No anon/authenticated policies on purpose: all reads/writes go through
-- the service-role client in server actions. Social login can add a
-- "customer reads own row" policy later using auth_user_id.

-- ─── Coupon redemptions (per-customer usage limit) ─────────────

create table if not exists public.coupon_redemptions (
    id uuid primary key default gen_random_uuid(),
    coupon_id uuid not null references public.coupons (id) on delete cascade,
    customer_phone text not null,
    order_id uuid references public.orders (id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_phone_idx
    on public.coupon_redemptions (coupon_id, customer_phone);

alter table public.coupon_redemptions enable row level security;

-- Service-role only, same as customers.

-- ─── Helpful index for order history by phone ──────────────────

create index if not exists orders_customer_phone_idx on public.orders (customer_phone);
