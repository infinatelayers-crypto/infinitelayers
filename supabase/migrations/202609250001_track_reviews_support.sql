-- Track order (order_no + phone), reviews, support messages, and extra settings.
-- Run after 202609240001_settings_coupons.sql. Safe to run repeatedly.

-- 1. Extra settings columns.
alter table public.store_settings add column if not exists support_email text not null default '';
alter table public.store_settings add column if not exists support_form_url text not null default '';
alter table public.store_settings add column if not exists feedback_form_url text not null default '';

-- 2. Track order: return a safe, masked view when order_no + phone match.
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
    -- Only reveal the last line/pincode-ish hint, never the full address.
    ('•••• ' || right(regexp_replace(v_order.address, '\s+', ' ', 'g'), 12))::text;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;

-- 3. Reviews.
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

-- Public can read ONLY approved reviews; admin can read all.
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

-- Public submits via a definer function (always unapproved, sanitized).
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

-- 4. Support messages.
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
