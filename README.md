# Infinite Layers

A mobile-first e-commerce store and private admin control room for a small
3D-printing brand. Built with Next.js 16, Supabase, and Tailwind CSS.

## Features

**Storefront**
- Shop-first home, product search, product pages with photo galleries
- Cart + checkout with a full price breakup (subtotal, delivery, discount)
- Coupon codes, delivery charges, and free-delivery threshold
- Track order (by order number or phone), reviews, and a help/support page
- Light / dark theme toggle, no customer login required

**Admin (`/admin`)**
- Private Supabase email/password login (allowlist + rate limiting)
- Products (with up to 6 photos), bookings/orders with statuses
- Coupons, reviews moderation, support inbox
- Editable site settings: hero text, Instagram, WhatsApp, email, delivery,
  and Formspree links — no code needed

**Payments**
- Razorpay checkout + server-side signature verification + webhook backstop
- Stays dormant until keys are added (checkout saves the order and the shop
  confirms payment manually)

## Local development

```powershell
npm install
Copy-Item .env.example .env.local   # then fill in the values
npm run dev
```

Open `http://localhost:3000` (store) or `http://localhost:3000/admin/login`.

## One-time Supabase setup

1. Create a project at supabase.com.
2. SQL Editor → run the entire `supabase/schema.sql` (creates all tables,
   security policies, storage bucket, and functions; safe to re-run).
3. Authentication → Users → create the admin email/password user
   (turn on "Auto Confirm User").
4. SQL Editor → approve that user (replace the email):
   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@example.com'
   on conflict (user_id) do nothing;
   ```
5. Sign in at `/admin/login` and add products.

## Environment variables

Set these in `.env.local` (local) and in Vercel → Settings → Environment
Variables (production). Only the first two are required to run.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Settings → API (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | anon/publishable key (public, safe to expose) |
| `NEXT_PUBLIC_SITE_URL` | yes | your deployed URL |
| `ENABLE_DEMO_CATALOG` | no | keep `false` in production |
| `SUPABASE_SERVICE_ROLE_KEY` | payments | secret — needed only for the Razorpay webhook |
| `RAZORPAY_KEY_ID` | payments | leave blank to keep payments dormant |
| `RAZORPAY_KEY_SECRET` | payments | secret |
| `RAZORPAY_WEBHOOK_SECRET` | payments | secret — must match the Razorpay webhook |

Keep every "secret" value out of `NEXT_PUBLIC_*` and out of git.

## Deploy on Vercel

1. Import the repo. Framework auto-detects Next.js (enforced by `vercel.json`).
2. Add the environment variables above (at least the two required ones).
3. Deploy. After the first deploy, set `NEXT_PUBLIC_SITE_URL` to the real
   domain and redeploy.

## Enabling Razorpay (when the store owner has an account)

Payments are fully built and dormant until keys exist. To turn them on:

1. **Razorpay dashboard** → API Keys → copy `Key ID` and `Key Secret`
   (use Test mode first — no KYC needed to test).
2. **Vercel → Environment Variables** → add:
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `RAZORPAY_WEBHOOK_SECRET` (any strong value you choose)
   - `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API → service_role)
   Then redeploy.
3. **Razorpay dashboard → Settings → Webhooks → Add**:
   - URL: `https://YOUR_DOMAIN/api/webhooks/razorpay`
   - Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`
   - Events: `payment.captured`, `payment.failed`

Test card in Test mode: `4111 1111 1111 1111`, any future expiry/CVV,
or UPI `success@razorpay`.

## Validation

```powershell
npm run lint
npx tsc --noEmit
npm run build
```
