"use client";

import { PackageSearch, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { formatInr } from "@/lib/format";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_production: "In production",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "in_production",
  "ready",
  "shipped",
  "delivered",
];

type TrackedItem = {
  productId: string;
  name: string;
  pricePaise: number;
  quantity: number;
};

type TrackedOrder = {
  orderNo: string;
  status: string;
  paymentStatus: string;
  items: TrackedItem[];
  subtotalPaise: number;
  deliveryPaise: number;
  discountPaise: number;
  totalPaise: number;
  createdAt: string;
  addressHint: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function OrderCard({ order }: { order: TrackedOrder }) {
  const activeStep = STATUS_STEPS.indexOf(order.status);
  const cancelled = order.status === "cancelled";

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-bold text-fg">
            {order.orderNo}
          </p>
          <p className="text-xs text-fg-subtle">
            Placed {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              order.paymentStatus === "paid"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-accent-soft text-accent"
            }`}
          >
            {order.paymentStatus === "paid" ? "Paid" : "Payment pending"}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              cancelled
                ? "bg-red-500/10 text-red-500 dark:text-red-300"
                : "bg-surface-2 text-fg"
            }`}
          >
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {!cancelled ? (
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, index) => (
            <div key={step} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <div
                  className={`h-1.5 flex-1 rounded-full ${
                    index <= activeStep ? "bg-accent" : "bg-surface-2"
                  }`}
                />
              </div>
              <span
                className={`text-center text-[10px] ${
                  index <= activeStep ? "text-fg" : "text-fg-subtle"
                }`}
              >
                {STATUS_LABELS[step]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          This order was cancelled. Contact us if this is unexpected.
        </p>
      )}

      <div className="space-y-2 border-t border-border pt-4 text-sm">
        {order.items.map((item) => (
          <div key={item.productId} className="flex justify-between gap-3">
            <span className="text-fg-muted">
              {item.name}{" "}
              <span className="text-fg-subtle">× {item.quantity}</span>
            </span>
            <span className="font-medium text-fg">
              {formatInr(item.pricePaise * item.quantity)}
            </span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-fg">
          <span>Total</span>
          <span>{formatInr(order.totalPaise)}</span>
        </div>
        <p className="pt-1 text-xs text-fg-subtle">Ships to {order.addressHint}</p>
      </div>
    </div>
  );
}

export function TrackOrder({ initialOrderNo = "" }: { initialOrderNo?: string }) {
  const [orderNo, setOrderNo] = useState(initialOrderNo);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<TrackedOrder[] | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setOrders(null);

    if (!orderNo.trim() && !phone.trim()) {
      setError("Enter your order number or phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: orderNo.trim(), phone }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        orders?: TrackedOrder[];
      };
      if (!data.ok || !data.orders) {
        setError(data.message ?? "Could not find your order.");
        return;
      }
      setOrders(data.orders);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-border bg-surface p-5 shadow-card sm:p-6"
      >
        <p className="mb-4 text-sm text-fg-muted">
          Enter <span className="font-semibold text-fg">either</span> your order
          number <span className="font-semibold text-fg">or</span> your phone
          number. Phone shows all your orders.
        </p>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">
              Order number
            </span>
            <input
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value.toUpperCase())}
              placeholder="Enter your order number"
              className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-fg">
              or Phone number
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              placeholder="Enter your 10-digit phone"
              className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            />
          </label>
          <button
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <PackageSearch size={16} />
            )}
            Track
          </button>
        </div>
        {error ? (
          <p className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {error}
          </p>
        ) : null}
      </form>

      {orders && orders.length > 0 ? (
        <div className="space-y-4">
          {orders.length > 1 ? (
            <p className="text-sm text-fg-muted">
              Found {orders.length} orders for this phone.
            </p>
          ) : null}
          {orders.map((order) => (
            <OrderCard key={order.orderNo} order={order} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
