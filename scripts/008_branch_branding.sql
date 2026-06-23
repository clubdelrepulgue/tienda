-- ============================================================
-- BRANCH BRANDING
-- Per-sucursal storefront identity: logo, banner, colors and hero copy.
-- Run after 007_multi_branch_menus.sql
-- ============================================================

alter table public.sucursales
  add column if not exists logo_url text,
  add column if not exists banner_url text,
  add column if not exists brand_color text default '#E86303',
  add column if not exists accent_color text default '#F97316',
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text;

update public.sucursales
set
  logo_url = coalesce(logo_url, ''),
  banner_url = coalesce(banner_url, ''),
  brand_color = coalesce(nullif(brand_color, ''), '#E86303'),
  accent_color = coalesce(nullif(accent_color, ''), '#F97316'),
  hero_title = coalesce(hero_title, ''),
  hero_subtitle = coalesce(hero_subtitle, '');
