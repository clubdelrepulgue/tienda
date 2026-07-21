-- 015: Bind loyalty rewards to the customer that earned them.
--
-- Until now a FIDE-* reward was an ordinary global coupon: anyone who saw the
-- code could spend it, it showed up in /admin/coupons next to the marketing
-- ones (deleting it silently orphaned `customers.reward_coupon_code`), and the
-- 004 trigger burned its single use even on orders that never recorded a
-- redemption.

-- ─── Ownership ─────────────────────────────────────────────────
-- NULL = public coupon (marketing). Non-NULL = personal reward, redeemable
-- only by that normalized phone.

alter table public.coupons
    add column if not exists customer_phone text;

create index if not exists coupons_customer_phone_idx
    on public.coupons (customer_phone)
    where customer_phone is not null;

-- Backfill: every reward still referenced by a customer belongs to them.
update public.coupons c
set customer_phone = cu.phone
from public.customers cu
where cu.reward_coupon_code = c.code
  and c.customer_phone is null;

-- Remaining FIDE-* rows with no owner are from before this migration and
-- carry the phone in their description ("... — cliente 96219905").
update public.coupons
set customer_phone = nullif(regexp_replace(description, '^.*— cliente ', ''), description)
where customer_phone is null
  and code like 'FIDE-%'
  and description like '%— cliente %';

-- ─── Heal dangling rewards ─────────────────────────────────────
-- A customer pointing at a coupon that no longer exists sees a code that
-- always fails validation. Clear it so the UI falls back to the progress bar.

update public.customers cu
set reward_coupon_code = null
where cu.reward_coupon_code is not null
  and not exists (
      select 1 from public.coupons c where c.code = cu.reward_coupon_code
  );

-- ─── Hide personal rewards from the public policy ──────────────
-- `validateCoupon` reads through the service-role client, so the anon policy
-- no longer needs to expose personal codes (which would let anyone enumerate
-- and spend other people's rewards).

do $$
begin
    drop policy if exists "Coupons visible to public" on public.coupons;

    create policy "Coupons visible to public"
        on public.coupons for select
        using (
            is_active = true
            and customer_phone is null
            and (valid_until is null or valid_until > now())
        );
exception when others then
    raise notice 'Error en policy de coupons: %', sqlerrm;
end $$;

-- ─── Usage accounting ──────────────────────────────────────────
-- Drop the 004 trigger: it incremented `usage_count` for any order carrying a
-- coupon_code, including ones the server rejected for the per-customer limit
-- and POS orders with no usable phone — burning single-use rewards that were
-- never actually redeemed. createOrder now does this atomically, in the same
-- place it writes coupon_redemptions.

drop trigger if exists tr_increment_coupon_usage on public.orders;
drop function if exists public.increment_coupon_usage();

create or replace function public.bump_coupon_usage(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.coupons
    set usage_count = coalesce(usage_count, 0) + 1
    where id = p_coupon_id;
$$;

revoke all on function public.bump_coupon_usage(uuid) from public, anon, authenticated;
grant execute on function public.bump_coupon_usage(uuid) to service_role;
