-- Razorpay webhook backstop support.
-- Lets the server (a) record the Razorpay order id when the payment order is
-- created, and (b) mark an order paid using ONLY the Razorpay order id, which
-- is all a webhook payload carries. Both are idempotent.
-- Run after 202609220001_order_numbers_payments.sql. Safe to run repeatedly.

create index if not exists orders_razorpay_order_id_idx
  on public.orders (razorpay_order_id);

-- Attach the Razorpay order id to our order (looked up by checkout_token).
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

-- Mark paid using the Razorpay order id (webhook path). Idempotent: a second
-- call for an already-paid order is a no-op and still returns the order.
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
-- Webhook route uses the service role; grant kept minimal.
grant execute on function public.mark_order_paid_by_rp(text, text) to service_role;

-- Also let the webhook flag failed payments.
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
