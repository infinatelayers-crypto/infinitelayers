import Link from "next/link";
import { Check } from "lucide-react";

type Props = {
  searchParams: Promise<{ order?: string; paid?: string }>;
};

export default async function OrderSuccessPage({ searchParams }: Props) {
  const { order, paid } = await searchParams;
  const isPaid = paid === "1";

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{
          background:
            "radial-gradient(50% 100% at 50% 0%, var(--hero-glow), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500 ring-8 ring-emerald-500/5">
          <Check className="h-7 w-7" strokeWidth={3} />
        </div>
        <h1 className="font-display mt-6 text-3xl font-bold text-fg">
          {isPaid ? "Payment successful" : "Booking received"}
        </h1>

        {order ? (
          <div className="mx-auto mt-5 inline-flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface px-6 py-4">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-fg-subtle">
              Your order number
            </span>
            <span className="font-display text-xl font-bold text-fg">
              {order}
            </span>
            {isPaid ? (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Paid
              </span>
            ) : (
              <span className="mt-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                Payment on confirmation
              </span>
            )}
          </div>
        ) : null}

        <p className="mx-auto mt-5 max-w-sm leading-relaxed text-fg-muted">
          {isPaid
            ? "Thanks! We've got your payment and will start on your order. We'll update you on WhatsApp."
            : "We'll confirm your order on WhatsApp at the number you provided. Keep your order number handy."}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
          >
            Continue shopping
          </Link>
          {order ? (
            <Link
              href={`/track?order=${encodeURIComponent(order)}`}
              className="inline-flex h-11 items-center rounded-full border border-border-strong px-6 text-sm font-semibold text-fg transition hover:bg-surface-hover"
            >
              Track this order
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full border border-border-strong px-6 text-sm font-semibold text-fg transition hover:bg-surface-hover"
            >
              Back home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
