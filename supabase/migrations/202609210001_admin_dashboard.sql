-- Adds admin authorization, product galleries, secure order capture, and image storage.
-- This migration is intentionally upgrade-safe for the original Infinite Layers schema.
create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  details text not null default '',
  price_paise integer not null check (price_paise > 0),
  image_url text,
  image_urls text[] not null default '{}',
  category text not null default 'general',
  featured boolean not null default false,
  in_stock boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_image_urls_max_six check (cardinality(image_urls) <= 6)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  address text not null,
  items jsonb not null,
  total_paise integer not null,
  status text not null default 'pending',
  razorpay_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_positive check (total_paise > 0),
  constraint orders_status_valid check (
    status in ('pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled')
  )
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists details text not null default '';
alter table public.products add column if not exists image_urls text[] not null default '{}';
alter table public.products add column if not exists updated_at timestamptz not null default now();

update public.products
set image_urls = array[image_url]
where image_url is not null and cardinality(image_urls) = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_image_urls_max_six'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_image_urls_max_six check (cardinality(image_urls) <= 6);
  end if;
end
$$;

alter table public.orders add column if not exists updated_at timestamptz not null default now();

update public.orders
set status = 'pending'
where status not in ('pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_valid'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_status_valid check (
        status in ('pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_total_positive'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_total_positive check (total_paise > 0) not valid;
  end if;
end
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
before update on public.products
for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch_updated_at on public.orders;
create trigger orders_touch_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "Public read products" on public.products;
create policy "Public read products"
on public.products for select
to anon, authenticated
using (true);

drop policy if exists "Admins create products" on public.products;
create policy "Admins create products"
on public.products for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins update products" on public.products;
create policy "Admins update products"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete products" on public.products;
create policy "Admins delete products"
on public.products for delete
to authenticated
using (public.is_admin());

drop policy if exists "Admins read own membership" on public.admin_users;
create policy "Admins read own membership"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Admins read orders" on public.orders;
create policy "Admins read orders"
on public.orders for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update orders" on public.orders;
create policy "Admins update orders"
on public.orders for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.orders add column if not exists checkout_token uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_checkout_token_unique'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_checkout_token_unique unique (checkout_token);
  end if;
end
$$;

create index if not exists orders_phone_created_idx
  on public.orders (phone, created_at desc);

drop function if exists public.create_store_order(text, text, jsonb);

create or replace function public.create_store_order(
  p_phone text,
  p_address text,
  p_items jsonb,
  p_expected_total integer,
  p_checkout_token uuid
)
returns table (order_id uuid, total_paise integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_product_id_text text;
  v_quantity integer;
  v_quantity_text text;
  v_seen uuid[] := array[]::uuid[];
  v_canonical_items jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_order_id uuid := gen_random_uuid();
  v_existing public.orders%rowtype;
  v_recent_count integer;
begin
  p_phone := trim(coalesce(p_phone, ''));
  p_address := trim(coalesce(p_address, ''));

  if p_checkout_token is null then
    raise exception 'A checkout token is required' using errcode = '22023';
  end if;

  select * into v_existing from public.orders where checkout_token = p_checkout_token;
  if found then
    return query select v_existing.id, v_existing.total_paise;
    return;
  end if;

  if p_phone !~ '^[0-9]{10}$' then
    raise exception 'A valid 10-digit phone number is required' using errcode = '22023';
  end if;

  if length(p_address) < 10 or length(p_address) > 600 then
    raise exception 'A delivery address between 10 and 600 characters is required' using errcode = '22023';
  end if;

  select count(*) into v_recent_count
  from public.orders
  where phone = p_phone and created_at > now() - interval '10 minutes';

  if v_recent_count >= 8 then
    raise exception 'Too many booking attempts. Please wait a few minutes.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 20 then
    raise exception 'The order must contain between 1 and 20 products' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;

    v_product_id_text := coalesce(v_item ->> 'productId', '');
    v_quantity_text := coalesce(v_item ->> 'quantity', '');

    if v_product_id_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or v_quantity_text !~ '^[1-9][0-9]*$' then
      raise exception 'Invalid product or quantity' using errcode = '22023';
    end if;

    v_product_id := v_product_id_text::uuid;
    v_quantity := v_quantity_text::integer;

    if v_quantity > 10 or v_product_id = any(v_seen) then
      raise exception 'Each product must have one quantity between 1 and 10' using errcode = '22023';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id;

    if not found or not v_product.in_stock then
      raise exception 'A selected product is unavailable' using errcode = '22023';
    end if;

    v_seen := array_append(v_seen, v_product_id);
    v_total := v_total + (v_product.price_paise::bigint * v_quantity);

    if v_total > 100000000 then
      raise exception 'Order total is above the supported limit' using errcode = '22023';
    end if;

    v_canonical_items := v_canonical_items || jsonb_build_array(
      jsonb_build_object(
        'productId', v_product.id,
        'slug', v_product.slug,
        'name', v_product.name,
        'pricePaise', v_product.price_paise,
        'imageUrl', coalesce(v_product.image_urls[1], v_product.image_url),
        'quantity', v_quantity
      )
    );
  end loop;

  if p_expected_total is null or p_expected_total <> v_total::integer then
    raise exception 'The order total changed. Please review the updated price.' using errcode = '22023';
  end if;

  insert into public.orders (id, phone, address, items, total_paise, status, checkout_token)
  values (v_order_id, p_phone, p_address, v_canonical_items, v_total::integer, 'pending', p_checkout_token);

  return query select v_order_id, v_total::integer;
end;
$$;

revoke all on function public.create_store_order(text, text, jsonb, integer, uuid) from public;
grant execute on function public.create_store_order(text, text, jsonb, integer, uuid) to anon, authenticated;

grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
revoke all on public.orders from anon, authenticated;
grant select, update on public.orders to authenticated;
revoke all on public.admin_users from anon, authenticated;
grant select on public.admin_users to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins upload product images" on storage.objects;
create policy "Admins upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins update product images" on storage.objects;
create policy "Admins update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins delete product images" on storage.objects;
create policy "Admins delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- After creating the friend in Authentication → Users, run once with their email:
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'friend@example.com'
-- on conflict (user_id) do nothing;
