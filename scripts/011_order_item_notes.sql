-- ============================================================
-- PER-ITEM NOTES
-- ============================================================
-- Optional free-text comment a customer can add to a single cart
-- line before adding it to the cart (e.g. "sin cebolla", "bien cocida").
-- This is per order line, separate from the order-level `orders.notes`.
-- Run after 010_product_variants.sql
-- ============================================================

alter table public.order_items
  add column if not exists nota text;

do $$
begin
  raise notice 'Order item notes migration completed';
end $$;
