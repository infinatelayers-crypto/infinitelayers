-- ============================================================================
-- Infinite Layers — one-shot fix for Track / Reviews / Support / WhatsApp / Email
-- Paste this ENTIRE file into Supabase → SQL Editor → Run.
-- It is safe to run multiple times. It assumes the base tables (orders,
-- store_settings, reviews?, support_messages?) may or may not exist and creates
-- what is missing. It does NOT touch products/orders data.
-- ============================================================================

-- 0. Make sure helper for admin checks exists (used by RLS below).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- 1. Settings columns for contact toggles.
alter table public.store_settings add column if not exists support_email text not null default '';
alter table public.store_settings add column if not exists support_form_url text not null default '';
alter table public.store_settings add column if not exists feedback_form_url text not null default '';
alter table public.store_settings add column if not exists show_whatsapp boolean not null default false;
alter table public.store_settings add column if not exists show_email boolean not null default false;

-- 2. Reviews table + policies + submit function.
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rating integer not null check (rating between 1 and 5),
  message text not null,
  approved boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;

drop policy if exists "Public read approved reviews" on public.reviews;
create policy "Public read approved reviews" on public.reviews for select
  to anon, authenticated using (approved or public.is_admin());
drop policy if exists "Admins update reviews" on public.reviews;
create policy "Admins update reviews" on public.reviews for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete reviews" on public.reviews;
create policy "Admins delete reviews" on public.reviews for delete
  to authenticated using (public.is_admin());
grant select on public.reviews to anon, authenticated;
grant update, delete on public.reviews to authenticated;

create or replace function public.submit_review(p_name text, p_rating integer, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text := trim(coalesce(p_name,'')); v_message text := trim(coalesce(p_message,''));
begin
  if length(v_name) < 2 or length(v_name) > 60 then raise exception 'Enter your name' using errcode='22023'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then raise exception 'Rating must be 1 to 5' using errcode='22023'; end if;
  if length(v_message) < 4 or length(v_message) > 800 then raise exception 'Enter a short review' using errcode='22023'; end if;
  insert into public.reviews (name, rating, message) values (v_name, p_rating, v_message);
end; $$;
grant execute on function public.submit_review(text, integer, text) to anon, authenticated;

-- 3. Support messages table + policies + submit function.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null,
  message text not null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;

drop policy if exists "Admins read support" on public.support_messages;
create policy "Admins read support" on public.support_messages for select
  to authenticated using (public.is_admin());
drop policy if exists "Admins update support" on public.support_messages;
create policy "Admins update support" on public.support_messages for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Admins delete support" on public.support_messages;
create policy "Admins delete support" on public.support_messages for delete
  to authenticated using (public.is_admin());
grant select, update, delete on public.support_messages to authenticated;

create or replace function public.submit_support_message(p_name text, p_contact text, p_message text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_name text := trim(coalesce(p_name,'')); v_contact text := trim(coalesce(p_contact,'')); v_message text := trim(coalesce(p_message,''));
begin
  if length(v_name) < 2 or length(v_name) > 80 then raise exception 'Enter your name' using errcode='22023'; end if;
  if length(v_contact) < 5 or length(v_contact) > 120 then raise exception 'Enter a phone or email' using errcode='22023'; end if;
  if length(v_message) < 4 or length(v_message) > 1500 then raise exception 'Enter your message' using errcode='22023'; end if;
  insert into public.support_messages (name, contact, message) values (v_name, v_contact, v_message);
end; $$;
grant execute on function public.submit_support_message(text, text, text) to anon, authenticated;

-- 4. Flexible order tracking (phone OR order number).
create or replace function public.track_orders(p_order_no text, p_phone text)
returns table (
  order_no text, status text, payment_status text, items jsonb,
  subtotal_paise integer, delivery_paise integer, discount_paise integer,
  total_paise integer, created_at timestamptz, address_hint text
) language plpgsql security definer set search_path = '' as $$
declare
  v_order_no text := trim(coalesce(p_order_no,''));
  v_phone text := regexp_replace(coalesce(p_phone,''), '[^0-9]', '', 'g');
begin
  if length(v_order_no) = 0 and length(v_phone) = 0 then
    raise exception 'Enter your order number or phone number' using errcode='22023';
  end if;
  if length(v_phone) > 0 and v_phone !~ '^[0-9]{10}$' then
    raise exception 'Enter a valid 10-digit phone number' using errcode='22023';
  end if;

  return query
    select o.order_no, o.status, o.payment_status, o.items,
      coalesce(o.subtotal_paise, o.total_paise), o.delivery_paise, o.discount_paise,
      o.total_paise, o.created_at,
      ('•••• ' || right(regexp_replace(o.address, '\s+', ' ', 'g'), 12))::text
    from public.orders o
    where (length(v_order_no) > 0 and upper(o.order_no) = upper(v_order_no))
       or (length(v_order_no) = 0 and length(v_phone) = 10 and o.phone = v_phone)
    order by o.created_at desc
    limit 50;

  if not found then raise exception 'No orders found' using errcode='22023'; end if;
end; $$;
grant execute on function public.track_orders(text, text) to anon, authenticated;

-- Done. Verify:
--   select show_whatsapp, show_email from public.store_settings;
--   select routine_name from information_schema.routines
--     where routine_schema='public'
--       and routine_name in ('track_orders','submit_review','submit_support_message');
