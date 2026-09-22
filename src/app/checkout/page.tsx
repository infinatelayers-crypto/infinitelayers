import { CheckoutForm } from "@/components/checkout-form";
import { getStoreSettings } from "@/lib/settings";

export default async function CheckoutPage() {
  const settings = await getStoreSettings();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Almost there
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold text-fg sm:text-4xl">
          Checkout
        </h1>
        <p className="mt-2 text-fg-muted">
          Review your cart, then add your mobile and delivery address to place
          the booking.
        </p>
        <div className="mt-10">
          <CheckoutForm settings={settings} />
        </div>
      </div>
    </div>
  );
}
