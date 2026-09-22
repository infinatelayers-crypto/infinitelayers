-- Human-friendly order numbers + payment (Razorpay) fields.
-- Safe to run repeatedly. Run this after 202609210001_admin_dashboard.sql.

-- 1. New columns.
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

-- 2. Sequence that feeds a readable, sortable order number.
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
  -- Example: IL-260922-1042  (IL-YYMMDD-<seq>)
  return 'IL-' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || v_seq::text;
end;
$$;

-- Backfill any existing orders that predate this migration.
update public.orders
set order_no = public.next_order_no()
where order_no is null;

-- 3. v2 checkout RPC: same validation/repricing, now returns order_no.
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

-- 4. Mark an order paid after server-side Razorpay signature verification.
-- SECURITY DEFINER so the anon storefront can confirm its own verified payment,
-- but only by supplying the matching checkout_token (proof it owns the order).
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
