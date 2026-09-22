-- Infinite Layers canonical schema. Safe to run again on an existing project.
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

-- Upgrade the original starter schema in-place.
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
    -- Existing starter data may contain client-tampered totals. Enforce this for new rows
    -- without making the upgrade fail; validate after reviewing any legacy violations.
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

-- The storefront calls this constrained RPC. Direct anonymous inserts remain blocked.
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

  -- Idempotent replay: return the original order for a repeated attempt.
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

  -- Lightweight abuse guard: cap bookings per phone within a short window.
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

  -- Confirm the buyer agreed to the current price before booking.
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
drop function if exists public.create_store_order(text, text, jsonb);

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

-- ADMIN SETUP (run once after creating the friend in Authentication → Users):
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'friend@example.com'
-- on conflict (user_id) do nothing;

-- ============================================================================
-- Order numbers + payments (Razorpay). Also shipped as migration
-- 202609220001_order_numbers_payments.sql. Safe to run repeatedly.
-- ============================================================================

alter table public.orders add column if not exists order_no text;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists razorpay_payment_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_status_valid'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_valid
      check (payment_status in ('unpaid', 'paid', 'failed', 'refunded'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_order_no_unique'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_no_unique unique (order_no);
  end if;
end
$$;

create sequence if not exists public.order_no_seq start 1001;

create or replace function public.next_order_no()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seq bigint;
begin
  v_seq := nextval('public.order_no_seq');
  return 'IL-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || v_seq::text;
end;
$$;

update public.orders
set order_no = public.next_order_no()
where order_no is null;

create or replace function public.create_store_order_v2(
  p_phone text,
  p_address text,
  p_items jsonb,
  p_expected_total integer,
  p_checkout_token uuid
)
returns table (order_id uuid, order_no text, total_paise integer)
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
  v_order_no text := public.next_order_no();
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
    return query select v_existing.id, v_existing.order_no, v_existing.total_paise;
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

    select * into v_product from public.products where id = v_product_id;

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

  insert into public.orders
    (id, order_no, phone, address, items, total_paise, status, payment_status, checkout_token)
  values
    (v_order_id, v_order_no, p_phone, p_address, v_canonical_items, v_total::integer, 'pending', 'unpaid', p_checkout_token);

  return query select v_order_id, v_order_no, v_total::integer;
end;
$$;

revoke all on function public.next_order_no() from public;
revoke all on function public.create_store_order_v2(text, text, jsonb, integer, uuid) from public;
grant execute on function public.create_store_order_v2(text, text, jsonb, integer, uuid) to anon, authenticated;

create or replace function public.mark_order_paid(
  p_checkout_token uuid,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns table (order_id uuid, order_no text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where checkout_token = p_checkout_token;
  if not found then
    raise exception 'Order not found' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = 'paid',
      status = case when status = 'pending' then 'confirmed' else status end,
      razorpay_order_id = p_razorpay_order_id,
      razorpay_payment_id = p_razorpay_payment_id
  where id = v_order.id;

  return query select v_order.id, v_order.order_no;
end;
$$;

revoke all on function public.mark_order_paid(uuid, text, text) from public;
grant execute on function public.mark_order_paid(uuid, text, text) to anon, authenticated;

-- ============================================================================
-- Razorpay webhook backstop. Also shipped as migration
-- 202609230001_razorpay_webhook.sql. Safe to run repeatedly.
-- ============================================================================

create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

create or replace function public.attach_razorpay_order(
  p_checkout_token uuid,
  p_razorpay_order_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set razorpay_order_id = p_razorpay_order_id
  where checkout_token = p_checkout_token
    and razorpay_order_id is null;
end;
$$;

revoke all on function public.attach_razorpay_order(uuid, text) from public;
grant execute on function public.attach_razorpay_order(uuid, text) to anon, authenticated;

create or replace function public.mark_order_paid_by_rp(
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns table (order_id uuid, order_no text, was_paid boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
  from public.orders
  where razorpay_order_id = p_razorpay_order_id;

  if not found then
    raise exception 'Order not found for Razorpay order %', p_razorpay_order_id
      using errcode = '22023';
  end if;

  if v_order.payment_status = 'paid' then
    return query select v_order.id, v_order.order_no, true;
    return;
  end if;

  update public.orders
  set payment_status = 'paid',
      status = case when status = 'pending' then 'confirmed' else status end,
      razorpay_payment_id = coalesce(p_razorpay_payment_id, razorpay_payment_id)
  where id = v_order.id;

  return query select v_order.id, v_order.order_no, false;
end;
$$;

revoke all on function public.mark_order_paid_by_rp(text, text) from public;
grant execute on function public.mark_order_paid_by_rp(text, text) to service_role;

create or replace function public.mark_order_failed_by_rp(
  p_razorpay_order_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
  set payment_status = 'failed'
  where razorpay_order_id = p_razorpay_order_id
    and payment_status <> 'paid';
end;
$$;

revoke all on function public.mark_order_failed_by_rp(text) from public;
grant execute on function public.mark_order_failed_by_rp(text) to service_role;

-- ============================================================================
-- Store settings + coupons + delivery. Also shipped as migration
-- 202609240001_settings_coupons.sql. Safe to run repeatedly.
-- ============================================================================

create table if not exists public.store_settings (
  id boolean primary key default true,
  hero_badge text not null default 'Handcrafted 3D prints · Made in India',
  hero_title text not null default 'Cosplay, collectibles & custom 3D prints',
  hero_subtitle text not null default 'Shop precision-printed helmets, desk pieces, and made-to-order builds. Browse freely — checkout only when you''re ready.',
  about_text text not null default 'Endless possibilities in 3D printing — cosplay helmets, collectibles, and custom builds, crafted layer by layer in India.',
  instagram_url text not null default 'https://www.instagram.com/infinite_layers_/',
  whatsapp_number text not null default '',
  delivery_fee_paise integer not null default 0 check (delivery_fee_paise >= 0),
  free_delivery_over_paise integer not null default 0 check (free_delivery_over_paise >= 0),
  updated_at timestamptz not null default now(),
  constraint store_settings_single_row check (id)
);

insert into public.store_settings (id) values (true)
on conflict (id) do nothing;

drop trigger if exists store_settings_touch_updated_at on public.store_settings;
create trigger store_settings_touch_updated_at
before update on public.store_settings
for each row execute function public.touch_updated_at();

alter table public.store_settings enable row level security;

drop policy if exists "Public read settings" on public.store_settings;
create policy "Public read settings"
on public.store_settings for select
to anon, authenticated
using (true);

drop policy if exists "Admins update settings" on public.store_settings;
create policy "Admins update settings"
on public.store_settings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('flat', 'percent')),
  discount_value integer not null check (discount_value > 0),
  min_order_paise integer not null default 0 check (min_order_paise >= 0),
  max_discount_paise integer,
  active boolean not null default true,
  expires_at timestamptz,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (
    discount_type <> 'percent' or (discount_value >= 1 and discount_value <= 100)
  )
);

drop trigger if exists coupons_touch_updated_at on public.coupons;
create trigger coupons_touch_updated_at
before update on public.coupons
for each row execute function public.touch_updated_at();

alter table public.coupons enable row level security;

drop policy if exists "Admins read coupons" on public.coupons;
create policy "Admins read coupons"
on public.coupons for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins insert coupons" on public.coupons;
create policy "Admins insert coupons"
on public.coupons for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins update coupons" on public.coupons;
create policy "Admins update coupons"
on public.coupons for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete coupons" on public.coupons;
create policy "Admins delete coupons"
on public.coupons for delete
to authenticated
using (public.is_admin());

revoke all on public.coupons from anon, authenticated;
grant select, insert, update, delete on public.coupons to authenticated;

alter table public.orders add column if not exists subtotal_paise integer;
alter table public.orders add column if not exists delivery_paise integer not null default 0;
alter table public.orders add column if not exists discount_paise integer not null default 0;
alter table public.orders add column if not exists coupon_code text;

create or replace function public.compute_coupon_discount(
  p_code text,
  p_subtotal_paise integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount integer;
begin
  if p_code is null or length(trim(p_code)) = 0 then
    return 0;
  end if;

  select * into v_coupon
  from public.coupons
  where upper(code) = upper(trim(p_code));

  if not found or not v_coupon.active then
    raise exception 'Invalid or inactive coupon code' using errcode = '22023';
  end if;

  if v_coupon.expires_at is not null and v_coupon.expires_at < now() then
    raise exception 'This coupon has expired' using errcode = '22023';
  end if;

  if p_subtotal_paise < v_coupon.min_order_paise then
    raise exception 'Order does not meet the minimum for this coupon' using errcode = '22023';
  end if;

  if v_coupon.discount_type = 'flat' then
    v_discount := v_coupon.discount_value;
  else
    v_discount := (p_subtotal_paise * v_coupon.discount_value) / 100;
  end if;

  if v_coupon.max_discount_paise is not null and v_discount > v_coupon.max_discount_paise then
    v_discount := v_coupon.max_discount_paise;
  end if;

  if v_discount > p_subtotal_paise then
    v_discount := p_subtotal_paise;
  end if;

  return v_discount;
end;
$$;

revoke all on function public.compute_coupon_discount(text, integer) from public;
grant execute on function public.compute_coupon_discount(text, integer) to anon, authenticated;

create or replace function public.preview_coupon(
  p_code text,
  p_subtotal_paise integer
)
returns table (ok boolean, discount_paise integer, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount integer;
begin
  begin
    v_discount := public.compute_coupon_discount(p_code, p_subtotal_paise);
    return query select true, v_discount, 'Coupon applied'::text;
  exception when others then
    return query select false, 0, sqlerrm::text;
  end;
end;
$$;

revoke all on function public.preview_coupon(text, integer) from public;
grant execute on function public.preview_coupon(text, integer) to anon, authenticated;

create or replace function public.create_store_order_v3(
  p_phone text,
  p_address text,
  p_items jsonb,
  p_expected_total integer,
  p_checkout_token uuid,
  p_coupon_code text
)
returns table (
  order_id uuid,
  order_no text,
  subtotal_paise integer,
  delivery_paise integer,
  discount_paise integer,
  total_paise integer
)
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
  v_subtotal bigint := 0;
  v_delivery integer := 0;
  v_discount integer := 0;
  v_total bigint := 0;
  v_order_id uuid := gen_random_uuid();
  v_order_no text := public.next_order_no();
  v_existing public.orders%rowtype;
  v_recent_count integer;
  v_settings public.store_settings%rowtype;
  v_coupon_code text := nullif(trim(coalesce(p_coupon_code, '')), '');
begin
  p_phone := trim(coalesce(p_phone, ''));
  p_address := trim(coalesce(p_address, ''));

  if p_checkout_token is null then
    raise exception 'A checkout token is required' using errcode = '22023';
  end if;

  select * into v_existing from public.orders where checkout_token = p_checkout_token;
  if found then
    return query select v_existing.id, v_existing.order_no,
      coalesce(v_existing.subtotal_paise, v_existing.total_paise),
      v_existing.delivery_paise, v_existing.discount_paise, v_existing.total_paise;
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

    select * into v_product from public.products where id = v_product_id;

    if not found or not v_product.in_stock then
      raise exception 'A selected product is unavailable' using errcode = '22023';
    end if;

    v_seen := array_append(v_seen, v_product_id);
    v_subtotal := v_subtotal + (v_product.price_paise::bigint * v_quantity);

    if v_subtotal > 100000000 then
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

  select * into v_settings from public.store_settings where id;
  if found then
    if v_settings.free_delivery_over_paise > 0
      and v_subtotal >= v_settings.free_delivery_over_paise then
      v_delivery := 0;
    else
      v_delivery := v_settings.delivery_fee_paise;
    end if;
  end if;

  if v_coupon_code is not null then
    v_discount := public.compute_coupon_discount(v_coupon_code, v_subtotal::integer);
  end if;

  v_total := v_subtotal + v_delivery - v_discount;
  if v_total < 0 then
    v_total := 0;
  end if;

  if p_expected_total is null or p_expected_total <> v_total::integer then
    raise exception 'The order total changed. Please review the updated price.' using errcode = '22023';
  end if;

  insert into public.orders
    (id, order_no, phone, address, items, subtotal_paise, delivery_paise,
     discount_paise, coupon_code, total_paise, status, payment_status, checkout_token)
  values
    (v_order_id, v_order_no, p_phone, p_address, v_canonical_items, v_subtotal::integer,
     v_delivery, v_discount, v_coupon_code, v_total::integer, 'pending', 'unpaid', p_checkout_token);

  if v_coupon_code is not null and v_discount > 0 then
    update public.coupons
    set usage_count = usage_count + 1
    where upper(code) = upper(v_coupon_code);
  end if;

  return query select v_order_id, v_order_no, v_subtotal::integer, v_delivery, v_discount, v_total::integer;
end;
$$;

revoke all on function public.create_store_order_v3(text, text, jsonb, integer, uuid, text) from public;
grant execute on function public.create_store_order_v3(text, text, jsonb, integer, uuid, text) to anon, authenticated;

-- ============================================================================
-- Track order + reviews + support. Also shipped as migration
-- 202609250001_track_reviews_support.sql. Safe to run repeatedly.
-- ============================================================================

alter table public.store_settings add column if not exists support_email text not null default '';
alter table public.store_settings add column if not exists support_form_url text not null default '';
alter table public.store_settings add column if not exists feedback_form_url text not null default '';

create or replace function public.track_order(
  p_order_no text,
  p_phone text
)
returns table (
  order_no text,
  status text,
  payment_status text,
  items jsonb,
  subtotal_paise integer,
  delivery_paise integer,
  discount_paise integer,
  total_paise integer,
  created_at timestamptz,
  address_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  p_order_no := trim(coalesce(p_order_no, ''));
  p_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if length(p_order_no) = 0 or p_phone !~ '^[0-9]{10}$' then
    raise exception 'Enter your order number and the 10-digit phone used' using errcode = '22023';
  end if;

  select * into v_order
  from public.orders
  where upper(order_no) = upper(p_order_no) and phone = p_phone;

  if not found then
    raise exception 'No order found for that number and phone' using errcode = '22023';
  end if;

  return query select
    v_order.order_no,
    v_order.status,
    v_order.payment_status,
    v_order.items,
    coalesce(v_order.subtotal_paise, v_order.total_paise),
    v_order.delivery_paise,
    v_order.discount_paise,
    v_order.total_paise,
    v_order.created_at,
    ('•••• ' || right(regexp_replace(v_order.address, '\s+', ' ', 'g'), 12))::text;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reviews_public_idx
  on public.reviews (approved, featured, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews"
on public.reviews for select
to anon, authenticated
using (approved or public.is_admin());

drop policy if exists "Admins update reviews" on public.reviews;
create policy "Admins update reviews"
on public.reviews for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Admins delete reviews"
on public.reviews for delete
to authenticated
using (public.is_admin());

grant select on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

create or replace function public.submit_review(
  p_name text,
  p_rating integer,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  if length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'Enter your name' using errcode = '22023';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be 1 to 5' using errcode = '22023';
  end if;
  if length(v_message) < 4 or length(v_message) > 800 then
    raise exception 'Enter a short review (4-800 characters)' using errcode = '22023';
  end if;

  insert into public.reviews (name, rating, message, approved, featured)
  values (v_name, p_rating, v_message, false, false);
end;
$$;

revoke all on function public.submit_review(text, integer, text) from public;
grant execute on function public.submit_review(text, integer, text) to anon, authenticated;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists support_messages_created_idx
  on public.support_messages (handled, created_at desc);

alter table public.support_messages enable row level security;

drop policy if exists "Admins read support" on public.support_messages;
create policy "Admins read support"
on public.support_messages for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins update support" on public.support_messages;
create policy "Admins update support"
on public.support_messages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins delete support" on public.support_messages;
create policy "Admins delete support"
on public.support_messages for delete
to authenticated
using (public.is_admin());

revoke all on public.support_messages from anon, authenticated;
grant select, update, delete on public.support_messages to authenticated;

create or replace function public.submit_support_message(
  p_name text,
  p_contact text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_name, ''));
  v_contact text := trim(coalesce(p_contact, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Enter your name' using errcode = '22023';
  end if;
  if length(v_contact) < 5 or length(v_contact) > 120 then
    raise exception 'Enter a phone or email' using errcode = '22023';
  end if;
  if length(v_message) < 4 or length(v_message) > 1500 then
    raise exception 'Enter your message' using errcode = '22023';
  end if;

  insert into public.support_messages (name, contact, message)
  values (v_name, v_contact, v_message);
end;
$$;

revoke all on function public.submit_support_message(text, text, text) from public;
grant execute on function public.submit_support_message(text, text, text) to anon, authenticated;

-- Show/hide WhatsApp in footer. Also shipped as 202609260001_show_whatsapp.sql.
alter table public.store_settings
  add column if not exists show_whatsapp boolean not null default false;

-- Flexible tracking (phone OR order number). 202609270001_track_flexible.sql.
create or replace function public.track_orders(
  p_order_no text,
  p_phone text
)
returns table (
  order_no text,
  status text,
  payment_status text,
  items jsonb,
  subtotal_paise integer,
  delivery_paise integer,
  discount_paise integer,
  total_paise integer,
  created_at timestamptz,
  address_hint text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_no text := trim(coalesce(p_order_no, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if length(v_order_no) = 0 and length(v_phone) = 0 then
    raise exception 'Enter your order number or phone number' using errcode = '22023';
  end if;

  if length(v_phone) > 0 and v_phone !~ '^[0-9]{10}$' then
    raise exception 'Enter a valid 10-digit phone number' using errcode = '22023';
  end if;

  return query
    select
      o.order_no,
      o.status,
      o.payment_status,
      o.items,
      coalesce(o.subtotal_paise, o.total_paise),
      o.delivery_paise,
      o.discount_paise,
      o.total_paise,
      o.created_at,
      ('•••• ' || right(regexp_replace(o.address, '\s+', ' ', 'g'), 12))::text
    from public.orders o
    where
      (length(v_order_no) > 0 and upper(o.order_no) = upper(v_order_no))
      or (length(v_order_no) = 0 and length(v_phone) = 10 and o.phone = v_phone)
    order by o.created_at desc
    limit 50;

  if not found then
    raise exception 'No orders found' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.track_orders(text, text) from public;
grant execute on function public.track_orders(text, text) to anon, authenticated;

-- Admin login rate limiting. 202609280001_login_rate_limit.sql.
create table if not exists public.login_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_key text not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_key_idx
  on public.login_attempts (attempt_key, created_at desc);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.login_allowed(p_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fails integer;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return true;
  end if;

  select count(*) into v_fails
  from public.login_attempts
  where attempt_key = p_key
    and succeeded = false
    and created_at > now() - interval '15 minutes';

  return v_fails < 5;
end;
$$;

revoke all on function public.login_allowed(text) from public;
grant execute on function public.login_allowed(text) to anon, authenticated;

create or replace function public.record_login_attempt(p_key text, p_succeeded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or length(trim(p_key)) = 0 then
    return;
  end if;

  insert into public.login_attempts (attempt_key, succeeded)
  values (p_key, coalesce(p_succeeded, false));

  if p_succeeded then
    delete from public.login_attempts
    where attempt_key = p_key and succeeded = false;
  end if;

  delete from public.login_attempts
  where created_at < now() - interval '1 day';
end;
$$;

revoke all on function public.record_login_attempt(text, boolean) from public;
grant execute on function public.record_login_attempt(text, boolean) to anon, authenticated;
