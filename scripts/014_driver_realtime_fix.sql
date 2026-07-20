-- 014: Fix driver visibility on assigned orders.
--
-- Drivers authenticate with a lightweight phone lookup (see driverLogin in
-- app/actions.ts), not a real Supabase Auth session — drivers.user_id is
-- never populated. Since scripts/007_multi_branch_menus.sql tightened
-- "orders_select" to require can_access_sucursal() (which needs auth.uid()
-- in admin_users), the driver's browser (anon role, auth.uid() = null) has
-- been silently denied all SELECT access to orders: the /api/driver/orders
-- fetch always returned [], and Realtime postgres_changes never delivered
-- events to the driver dashboard channel either (Realtime enforces the same
-- RLS SELECT policy per connected role before pushing a change).
--
-- Postgres RLS combines multiple permissive policies for the same command
-- with OR, so this adds a policy scoped to already-assigned orders rather
-- than replacing the existing one. Order ids/driver ids are UUIDs (not
-- enumerable), so this does not meaningfully widen exposure beyond what a
-- driver_id holder could already reach via the driver dashboard itself.

drop policy if exists "orders_select_driver" on public.orders;
create policy "orders_select_driver" on public.orders
  for select using (driver_id is not null);

do $$
begin
  raise notice 'orders_select_driver policy created — drivers can now see assigned orders in real time';
end $$;
