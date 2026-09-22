# Infinite Layers

A mobile-first storefront and private control room for a small 3D-printing brand. Built with Next.js 16, Supabase, and Tailwind CSS.

## What is included

### Storefront
- Public home, shop, search, product, cart, checkout, and confirmation pages
- No customer account required
- Up to six photos and full specifications per product
- Phone number and delivery address requested only at checkout
- Server-validated bookings with authoritative product prices

### Admin (`/admin`)
- Private Supabase email/password login with an explicit admin allowlist
- Product create, edit, delete, stock, featured state, price, description, and specifications
- Direct uploads to the admin-protected `product-images` bucket (six photos, 8 MB each)
- Booking contact/address/item view and fulfilment statuses
- Overview metrics, booking pipeline, booked value, and seven-day activity

## Local setup

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set the public project URL and anon/publishable key in `.env.local`. The Supabase URL must look like `https://PROJECT_REF.supabase.co`—do not append `/rest/v1`.

Open `http://localhost:3000` for the store or `http://localhost:3000/admin/login` for admin.

## One-time Supabase setup

The remote project must be initialized before products, bookings, login, or image uploads can work.

1. In Supabase, open **SQL Editor**.
2. Run the complete contents of [`supabase/migrations/202609210001_admin_dashboard.sql`](supabase/migrations/202609210001_admin_dashboard.sql).
3. Open **Authentication → Users** and create the private email/password user for the store owner.
4. In SQL Editor, approve only that user (replace the example email):

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'friend@example.com'
on conflict (user_id) do nothing;
```

5. Sign in at `/admin/login` and create the first real product.

The migration creates the product/order tables, constrained booking RPC, admin authorization, Row Level Security policies, update triggers, and public-read/admin-write image bucket. There is no public admin sign-up.

## Environment variables

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key

# Reserved for narrowly scoped server work; never expose in browser code.
SUPABASE_SERVICE_ROLE_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local` is ignored by Git. Keep server-only keys out of `NEXT_PUBLIC_*` variables and out of `.env.example`.

## Payments (Razorpay)

Payment is fully wired and stays **dormant** until keys are present. With
`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` empty, checkout saves the order and
tells the customer the shop will confirm payment. Add keys and restart to go live.

Flow:
1. Server creates a Razorpay order (`/api/checkout`) and records its id on the order.
2. The browser opens the Razorpay popup.
3. On success, `/api/checkout/verify` checks the signature and marks the order **paid**.
4. A **webhook** (`/api/webhooks/razorpay`) is the backstop: if the customer closes
   the tab after paying, Razorpay still notifies the server, which reconciles the
   order. The webhook needs `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_WEBHOOK_SECRET`.

### Get test keys (free, no KYC)
1. [dashboard.razorpay.com](https://dashboard.razorpay.com) → toggle **Test Mode**.
2. **Settings → API Keys → Generate Test Key** → copy `Key ID` (`rzp_test_...`) and secret.
3. Put them in `.env.local` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) and restart.
4. Test card: `4111 1111 1111 1111`, any future expiry/CVV — or UPI `success@razorpay`.

### Set up the webhook
1. Deploy (or expose localhost via a tunnel like `ngrok`).
2. Razorpay → **Settings → Webhooks → Add** → URL `https://YOUR_DOMAIN/api/webhooks/razorpay`.
3. Set a **secret**; put the same value in `RAZORPAY_WEBHOOK_SECRET`.
4. Subscribe to events: `payment.captured`, `payment.failed` (optionally `order.paid`).
5. Add `SUPABASE_SERVICE_ROLE_KEY` to the environment so the webhook can update orders.

Run the SQL migrations in order before going live:
`202609210001_admin_dashboard.sql`, `202609220001_order_numbers_payments.sql`,
`202609230001_razorpay_webhook.sql` (all folded into `schema.sql` for fresh installs).

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm run build
```
