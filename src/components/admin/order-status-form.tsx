"use client";

import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/app/admin/actions";
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

export function OrderStatusForm({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [error, setError] = useState<string>();
  const [isPending, startTransition] = useTransition();

  function handleChange(nextStatus: OrderStatus) {
    const previousStatus = status;
    setStatus(nextStatus);
    setError(undefined);

    startTransition(async () => {
      const result = await updateOrderStatusAction(orderId, nextStatus);
      if (!result.ok) {
        setStatus(previousStatus);
        setError(result.error ?? "Could not update status.");
      }
    });
  }

  return (
    <div className="min-w-40">
      <select
        aria-label="Booking status"
        value={status}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value as OrderStatus)}
        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-fg outline-none transition focus:border-accent/50 disabled:opacity-60"
      >
        {ORDER_STATUSES.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABELS[option]}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-[10px] text-red-300">{error}</p> : null}
    </div>
  );
}
