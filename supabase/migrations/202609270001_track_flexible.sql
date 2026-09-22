-- Flexible order tracking: look up by phone (all orders) OR order number (one).
-- Run after 202609260001_show_whatsapp.sql. Safe to run repeatedly.

-- Returns a set of orders. If p_order_no is given, returns just that order
-- (still requires nothing else, since order numbers are the "key"). If only
-- p_phone is given, returns all orders for that phone, newest first.
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
