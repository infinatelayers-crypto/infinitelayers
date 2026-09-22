"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { formatInr, normalizePhone } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";

const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type CheckoutResponse = {
  ok?: boolean;
  payment?: "razorpay" | "manual";
  orderId?: string;
  orderNo?: string;
  totalPaise?: number;
  message?: string;
  razorpayKeyId?: string;
  razorpayOrderId?: string;
  checkoutToken?: string;
};

type AppliedCoupon = {
  code: string;
  discountPaise: number;
};

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function CheckoutForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const { items, subtotalPaise, clearCart, setQuantity, removeItem } =
    useCart();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const checkoutTokenRef = useRef<string>("");

  const deliveryPaise = useMemo(() => {
    if (
      settings.freeDeliveryOverPaise > 0 &&
      subtotalPaise >= settings.freeDeliveryOverPaise
    ) {
      return 0;
    }
    return settings.deliveryFeePaise;
  }, [settings, subtotalPaise]);

  const discountPaise = Math.min(coupon?.discountPaise ?? 0, subtotalPaise);
  const totalPaise = Math.max(0, subtotalPaise + deliveryPaise - discountPaise);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-12 text-center">
        <p className="text-fg-muted">Your cart is empty.</p>
        <button
          type="button"
          onClick={() => router.push("/shop")}
          className="mt-4 inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
        >
          Browse the shop
        </button>
      </div>
    );
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch("/api/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalPaise }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        discountPaise?: number;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setCoupon(null);
        setCouponError(data.message ?? "Invalid coupon.");
        return;
      }
      setCoupon({ code: code.toUpperCase(), discountPaise: data.discountPaise ?? 0 });
    } catch {
      setCouponError("Could not check that code.");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (address.trim().length < 10) {
      setError("Please enter your full delivery address (pincode & city included).");
      return;
    }

    if (!checkoutTokenRef.current) {
      checkoutTokenRef.current = crypto.randomUUID();
    }
    const token = checkoutTokenRef.current;

    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalized,
          address: address.trim(),
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          expectedTotalPaise: totalPaise,
          couponCode: coupon?.code ?? "",
          checkoutToken: token,
        }),
      });
      const data = (await res.json()) as CheckoutResponse;

      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Checkout failed");
      }

      if (
        data.payment === "razorpay" &&
        data.razorpayKeyId &&
        data.razorpayOrderId
      ) {
        await startRazorpay(data, token, normalized);
        return;
      }

      clearCart();
      router.push(`/order/success?order=${data.orderNo ?? data.orderId ?? ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function startRazorpay(
    data: CheckoutResponse,
    token: string,
    contact: string,
  ) {
    const ready = await loadRazorpayScript();
    if (!ready) {
      setError(
        "Could not load the payment window. Your order is saved — we'll contact you to confirm.",
      );
      clearCart();
      router.push(`/order/success?order=${data.orderNo ?? ""}`);
      return;
    }

    const razorpay = new window.Razorpay({
      key: data.razorpayKeyId!,
      amount: data.totalPaise ?? totalPaise,
      currency: "INR",
      name: "Infinite Layers",
      description: `Order ${data.orderNo ?? ""}`,
      order_id: data.razorpayOrderId!,
      prefill: { contact },
      theme: { color: "#f59e0b" },
      handler: async (response) => {
        try {
          const verifyRes = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              checkoutToken: token,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
          const verifyData = (await verifyRes.json()) as {
            ok?: boolean;
            orderNo?: string;
          };
          if (!verifyRes.ok || !verifyData.ok) {
            throw new Error("Payment verification failed");
          }
          clearCart();
          router.push(
            `/order/success?order=${verifyData.orderNo ?? data.orderNo ?? ""}&paid=1`,
          );
        } catch {
          setError(
            "Payment was taken but we could not verify it automatically. We'll confirm your order shortly.",
          );
          setLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          setError(
            "Payment window closed. Your order is saved as pending — reopen to pay or we'll reach out.",
          );
          setLoading(false);
        },
      },
    });

    razorpay.open();
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <form onSubmit={handlePay} className="space-y-6">
        <div>
          <h2 className="font-display text-xl font-semibold text-fg">
            Delivery details
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            No account needed — we only ask for this when you place your booking.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-fg">Mobile number</span>
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Enter your 10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-12 w-full rounded-xl border border-border bg-surface px-4 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-fg">Delivery address</span>
          <textarea
            rows={4}
            autoComplete="off"
            placeholder="Enter your full delivery address with name, city and PIN code"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full resize-y rounded-xl border border-border bg-surface px-4 py-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            required
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? "Saving booking…" : `Place booking · ${formatInr(totalPaise)}`}
        </button>

        <p className="text-xs leading-relaxed text-fg-subtle">
          Secure payment via Razorpay. If online payment isn&apos;t available,
          your order is saved and the shop confirms payment with you directly.
        </p>
      </form>

      <aside className="h-fit rounded-2xl border border-border bg-surface p-6">
        <h3 className="font-display text-lg font-semibold text-fg">
          Order summary
        </h3>
        <ul className="mt-4 space-y-4">
          {items.map((item) => (
            <li key={item.productId} className="flex items-start gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{item.name}</p>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  {formatInr(item.pricePaise)} each
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="inline-flex items-center rounded-lg border border-border">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => {
                        setQuantity(item.productId, item.quantity - 1);
                        setCoupon(null);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-l-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-fg">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={item.quantity >= 10}
                      onClick={() => {
                        setQuantity(item.productId, item.quantity + 1);
                        setCoupon(null);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-r-lg text-fg-muted transition hover:bg-surface-hover hover:text-fg disabled:opacity-40"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => {
                      removeItem(item.productId);
                      setCoupon(null);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <span className="shrink-0 font-semibold text-fg">
                {formatInr(item.pricePaise * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        {/* Coupon */}
        <div className="mt-5 border-t border-border pt-5">
          {coupon ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" /> {coupon.code} applied
              </span>
              <button
                type="button"
                onClick={removeCoupon}
                aria-label="Remove coupon"
                className="text-fg-subtle transition hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="h-11 w-full rounded-xl border border-border bg-bg pl-9 pr-3 text-sm uppercase text-fg outline-none transition placeholder:text-fg-subtle placeholder:normal-case focus:border-accent/50"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyCoupon}
                  disabled={couponLoading || !couponInput.trim()}
                  className="h-11 shrink-0 rounded-xl border border-border-strong px-4 text-sm font-semibold text-fg transition hover:bg-surface-hover disabled:opacity-50"
                >
                  {couponLoading ? "…" : "Apply"}
                </button>
              </div>
              {couponError ? (
                <p className="text-xs text-red-500 dark:text-red-300">
                  {couponError}
                </p>
              ) : null}
            </div>
          )}
        </div>

        {/* Breakup */}
        <div className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
          <div className="flex justify-between text-fg-muted">
            <span>Subtotal</span>
            <span className="text-fg">{formatInr(subtotalPaise)}</span>
          </div>
          <div className="flex justify-between text-fg-muted">
            <span>Delivery</span>
            <span className="text-fg">
              {deliveryPaise === 0 ? "Free" : formatInr(deliveryPaise)}
            </span>
          </div>
          {discountPaise > 0 ? (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
              <span>Discount</span>
              <span>− {formatInr(discountPaise)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-fg">
            <span>Total</span>
            <span>{formatInr(totalPaise)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
