-- Store settings (admin-editable content + delivery rules) and coupons.
-- Checkout v3 recomputes subtotal + delivery - discount entirely server-side.
-- Run after 202609230001_razorpay_webhook.sql. Safe to run repeatedly.

-- 1. Single-row store settings.
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

-- Seed the single row if absent.
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

-- 2. Coupons.
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

-- Coupons are validated through SECURITY DEFINER functions, not read directly by anon.
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

-- 3. Order columns for the breakup.
alter table public.orders add column if not exists subtotal_paise integer;
alter table public.orders add column if not exists delivery_paise integer not null default 0;
alter table public.orders add column if not exists discount_paise integer not null default 0;
alter table public.orders add column if not exists coupon_code text;

-- 4. Coupon validation helper. Returns the discount in paise for a given
-- subtotal, or raises if invalid. SECURITY DEFINER so anon can validate without
-- reading the whole coupons table.
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

  -- Never discount more than the subtotal.
  if v_discount > p_subtotal_paise then
    v_discount := p_subtotal_paise;
  end if;

  return v_discount;
end;
$$;

revoke all on function public.compute_coupon_discount(text, integer) from public;
grant execute on function public.compute_coupon_discount(text, integer) to anon, authenticated;

-- Public-facing coupon preview: returns discount or a friendly error message.
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

-- 5. Checkout v3: adds delivery + coupon to the canonical repricing.
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

  -- Delivery from settings.
  select * into v_settings from public.store_settings where id;
  if found then
    if v_settings.free_delivery_over_paise > 0
      and v_subtotal >= v_settings.free_delivery_over_paise then
      v_delivery := 0;
    else
      v_delivery := v_settings.delivery_fee_paise;
    end if;
  end if;

  -- Coupon discount (validated server-side).
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
