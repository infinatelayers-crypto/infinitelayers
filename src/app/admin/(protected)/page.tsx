import Link from "next/link";
import {
  ArrowRight,
  Box,
  CheckCircle2,
  IndianRupee,
  Clock3,
  PackageOpen,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import { getAdminDashboardData } from "@/lib/admin/data";
import { formatInr } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  in_production: "In production",
  ready: "Ready",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();
  const maxDailyOrders = Math.max(
    1,
    ...data.dailyBookings.map((day) => day.orders),
  );
  const handledRate = data.orderCount
    ? Math.round((data.handledOrderCount / data.orderCount) * 100)
    : 0;

  const stats = [
    {
      label: "Open bookings",
      value: data.openOrderCount.toLocaleString("en-IN"),
      detail: `${data.orderCount} total bookings`,
      icon: Clock3,
      tone: "text-accent bg-accent-soft",
    },
    {
      label: "Booked value",
      value: formatInr(data.bookedValuePaise),
      detail: "Excludes cancelled orders",
      icon: IndianRupee,
      tone: "text-emerald-600 dark:text-emerald-300 bg-emerald-500/10",
    },
    {
      label: "Products live",
      value: data.inStockCount.toLocaleString("en-IN"),
      detail: `${data.productCount} products managed`,
      icon: Box,
      tone: "text-cyan-600 dark:text-cyan-300 bg-cyan-500/10",
    },
    {
      label: "Bookings handled",
      value: `${handledRate}%`,
      detail: `${data.handledOrderCount} delivered or closed`,
      icon: CheckCircle2,
      tone: "text-violet-600 dark:text-violet-300 bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Control room
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Store overview
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">
            Products, incoming bookings, fulfilment, and store value in one place.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover"
          >
            <PackageOpen size={17} /> Add product
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-fg transition hover:border-border-strong hover:bg-surface-hover"
          >
            Bookings <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, detail, icon: Icon, tone }) => (
          <article
            key={label}
            className="rounded-2xl border border-border bg-surface p-5"
          >
            <div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon size={19} />
            </div>
            <p className="text-sm font-medium text-fg-muted">{label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-fg">
              {value}
            </p>
            <p className="mt-2 text-xs text-fg-subtle">{detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_0.8fr]">
        <article className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                <TrendingUp size={17} className="text-accent" /> Last 7 days
              </p>
              <p className="mt-1 text-xs text-fg-subtle">
                Non-cancelled booking activity
              </p>
            </div>
            <p className="text-right text-sm font-bold text-fg">
              {formatInr(
                data.dailyBookings.reduce(
                  (total, day) => total + day.valuePaise,
                  0,
                ),
              )}
              <span className="block text-xs font-normal text-fg-subtle">
                booked
              </span>
            </p>
          </div>

          <div className="grid h-48 grid-cols-7 items-end gap-2 sm:gap-4">
            {data.dailyBookings.map((day) => (
              <div key={day.key} className="flex h-full flex-col justify-end gap-2">
                <div className="flex flex-1 items-end justify-center">
                  <div
                    className="group relative w-full max-w-10 rounded-t-lg bg-gradient-to-t from-accent-hover to-accent transition hover:brightness-110"
                    style={{
                      height: `${Math.max(6, (day.orders / maxDailyOrders) * 100)}%`,
                      opacity: day.orders ? 1 : 0.2,
                    }}
                  >
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-fg-muted">
                      {day.orders}
                    </span>
                  </div>
                </div>
                <p className="text-center text-[10px] text-fg-subtle sm:text-xs">
                  {day.label}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
          <p className="text-sm font-semibold text-fg">Booking pipeline</p>
          <p className="mt-1 text-xs text-fg-subtle">Current status breakdown</p>
          <div className="mt-6 space-y-3">
            {Object.entries(data.statusCounts).map(([status, count]) => {
              const percentage = data.orderCount
                ? Math.round((count / data.orderCount) * 100)
                : 0;
              return (
                <div key={status}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-fg-muted">
                      {STATUS_LABELS[status as OrderStatus]}
                    </span>
                    <span className="font-semibold text-fg">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">
              Latest bookings
            </h2>
            <p className="mt-1 text-xs text-fg-subtle">
              Most recently submitted orders
            </p>
          </div>
          <Link
            href="/admin/orders"
            className="text-sm font-semibold text-accent transition hover:text-accent-hover"
          >
            View all
          </Link>
        </div>

        {data.recentOrders.length ? (
          <div className="divide-y divide-border">
            {data.recentOrders.map((order) => (
              <div
                key={order.id}
                className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-6"
              >
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <ShoppingBag size={14} className="text-fg-subtle" />
                    {order.orderNo}
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    ••••••{order.phone.slice(-4)} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted">
                  {STATUS_LABELS[order.status]}
                </span>
                <p className="font-semibold text-fg">
                  {formatInr(order.totalPaise)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-14 text-center text-sm text-fg-subtle">
            No bookings yet. New checkout requests will appear here.
          </div>
        )}
      </section>
    </div>
  );
}
