import Link from "next/link";
import { MapPin, PackageOpen, Phone, ShoppingBag } from "lucide-react";
import { OrderStatusForm } from "@/components/admin/order-status-form";
import { getAdminOrders } from "@/lib/admin/data";
import { formatInr } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

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
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const [orders, query] = await Promise.all([getAdminOrders(), searchParams]);
  const selectedStatus = ORDER_STATUSES.find(
    (status) => status === query.status,
  );
  const visibleOrders = selectedStatus
    ? orders.filter((order) => order.status === selectedStatus)
    : orders;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Fulfilment
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">
          Bookings
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Review customer delivery details and move every order through production.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter bookings">
        <Link
          href="/admin/orders"
          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            !selectedStatus
              ? "bg-accent text-accent-fg"
              : "bg-surface-2 text-fg-muted hover:text-fg"
          }`}
        >
          All ({orders.length})
        </Link>
        {ORDER_STATUSES.map((status) => {
          const count = orders.filter((order) => order.status === status).length;
          return (
            <Link
              key={status}
              href={`/admin/orders?status=${status}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selectedStatus === status
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2 text-fg-muted hover:text-fg"
              }`}
            >
              {STATUS_LABELS[status]} ({count})
            </Link>
          );
        })}
      </nav>

      {visibleOrders.length ? (
        <section className="space-y-4">
          {visibleOrders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-display text-sm font-semibold text-fg">
                    <ShoppingBag size={15} className="text-accent" />
                    {order.orderNo}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        order.paymentStatus === "paid"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : order.paymentStatus === "refunded"
                            ? "bg-surface-2 text-fg-subtle"
                            : "bg-accent-soft text-accent"
                      }`}
                    >
                      {order.paymentStatus}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-fg-subtle">
                    Received {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <p className="font-display text-lg font-bold text-fg">
                    {formatInr(order.totalPaise)}
                  </p>
                  <OrderStatusForm
                    orderId={order.id}
                    currentStatus={order.status}
                  />
                </div>
              </div>

              <div className="grid gap-6 px-5 py-5 lg:grid-cols-[0.8fr_1fr_1.4fr]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-fg-subtle">
                    Contact
                  </p>
                  <a
                    href={`tel:+91${order.phone}`}
                    className="mt-2 flex items-center gap-2 text-sm font-semibold text-fg transition hover:text-accent-hover"
                  >
                    <Phone size={14} /> +91 {order.phone}
                  </a>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-fg-subtle">
                    Delivery address
                  </p>
                  <p className="mt-2 flex items-start gap-2 whitespace-pre-line text-sm leading-6 text-fg-muted">
                    <MapPin size={14} className="mt-1 shrink-0 text-fg-subtle" />
                    {order.address}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-fg-subtle">
                    Items
                  </p>
                  <div className="mt-2 space-y-2">
                    {order.items.length ? (
                      order.items.map((item) => (
                        <div
                          key={item.productId}
                          className="flex items-start justify-between gap-4 text-sm"
                        >
                          <p className="text-fg-muted">
                            <span className="mr-2 text-fg-subtle">
                              {item.quantity}×
                            </span>
                            {item.name}
                          </p>
                          <p className="shrink-0 text-xs font-semibold text-fg-subtle">
                            {formatInr(item.pricePaise * item.quantity)}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-fg-subtle">Legacy item details unavailable.</p>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-border bg-surface px-6 py-20 text-center">
          <PackageOpen className="mx-auto text-fg-subtle" size={34} />
          <h2 className="mt-4 font-display text-xl font-semibold text-fg">
            No bookings here
          </h2>
          <p className="mt-2 text-sm text-fg-subtle">
            {selectedStatus
              ? `There are no ${STATUS_LABELS[selectedStatus].toLowerCase()} bookings.`
              : "Customer checkout requests will appear here."}
          </p>
        </section>
      )}
    </div>
  );
}
