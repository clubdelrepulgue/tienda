-- ============================================================
-- STORAGE & IMAGES – Support multiple product images
-- ============================================================

-- 1. Create 'productos' bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

-- 2. Policies for 'productos' bucket
drop policy if exists "Productos public read" on storage.objects;
create policy "Productos public read" on storage.objects for select using ( bucket_id = 'productos' );

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images" on storage.objects for insert with check ( bucket_id = 'productos' and (select public.is_admin()) );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images" on storage.objects for update using ( bucket_id = 'productos' and (select public.is_admin()) );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images" on storage.objects for delete using ( bucket_id = 'productos' and (select public.is_admin()) );

-- 3. Schema update for multiple images
alter table public.productos 
add column if not exists images text[] default '{}';

-- Optional: Migrate existing single image_url to the new images array
update public.productos 
set images = array[image_url] 
where image_url is not null and image_url != '' and (images is null or array_length(images, 1) is null or array_length(images, 1) = 0);
