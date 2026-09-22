import { TrackOrder } from "@/components/track-order";

export const metadata = {
  title: "Track your order",
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(50% 100% at 50% 0%, var(--hero-glow), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Order status
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Track your order
          </h1>
          <p className="mt-3 text-fg-muted">
            Enter your order number and the phone number you used at checkout.
          </p>
        </div>
        <div className="mt-10">
          <TrackOrder initialOrderNo={order ?? ""} />
        </div>
      </div>
    </div>
  );
}
