"use client";

import {
  AlertCircle,
  LoaderCircle,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCouponAction,
  saveCouponAction,
  type CouponInput,
} from "@/app/admin/actions";
import { formatInr } from "@/lib/format";
import type { Coupon } from "@/lib/types";

export function CouponsManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setError(undefined);
    setShowForm(true);
  }

  function openEdit(coupon: Coupon) {
    setEditingId(coupon.id);
    setError(undefined);
    setShowForm(true);
  }

  // Prefill is driven by defaultValue + the form's key={editingId} remount.
  const editing: Coupon | undefined =
    editingId != null ? coupons.find((c) => c.id === editingId) : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);

    const type = String(formData.get("discountType")) === "percent"
      ? "percent"
      : "flat";
    const rawValue = Number(formData.get("discountValue"));
    const minRupees = Number(formData.get("minRupees"));
    const maxRupees = formData.get("maxRupees")
      ? Number(formData.get("maxRupees"))
      : null;
    const expiry = String(formData.get("expiresAt") ?? "").trim();

    const input: CouponInput = {
      code: String(formData.get("code") ?? ""),
      discountType: type,
      // Percent stays as a number; flat rupees convert to paise.
      discountValue:
        type === "percent"
          ? Math.round(rawValue)
          : Math.round(rawValue * 100),
      minOrderPaise: Number.isFinite(minRupees) ? Math.round(minRupees * 100) : 0,
      maxDiscountPaise:
        maxRupees && Number.isFinite(maxRupees)
          ? Math.round(maxRupees * 100)
          : null,
      active: formData.get("active") === "on",
      expiresAt: expiry ? new Date(expiry).toISOString() : null,
    };

    const result = await saveCouponAction(editingId, input);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save coupon.");
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this coupon?")) return;
    setBusyId(id);
    const result = await deleteCouponAction(id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.error ?? "Could not delete coupon.");
      return;
    }
    router.refresh();
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring";
  const labelClass = "mb-1.5 block text-sm font-semibold text-fg";

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover"
        >
          <Plus size={17} /> New coupon
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {showForm ? (
        <form
          key={editingId ?? "new"}
          onSubmit={handleSubmit}
          className="rounded-3xl border border-border bg-surface p-5 sm:p-6"
        >
          <div className="mb-5 flex items-center justify-between">
            <p className="font-display text-lg font-semibold text-fg">
              {editingId ? "Edit coupon" : "New coupon"}
            </p>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-fg-subtle transition hover:text-fg"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Code</span>
              <input
                name="code"
                required
                defaultValue={editing?.code ?? ""}
                placeholder="WELCOME10"
                className={`${inputClass} uppercase`}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Type</span>
              <select
                name="discountType"
                defaultValue={editing?.discountType ?? "flat"}
                className={inputClass}
              >
                <option value="flat">Flat (₹ off)</option>
                <option value="percent">Percent (% off)</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>
                Value (₹ for flat, % for percent)
              </span>
              <input
                name="discountValue"
                type="number"
                min="1"
                step="1"
                required
                defaultValue={
                  editing
                    ? editing.discountType === "percent"
                      ? editing.discountValue
                      : editing.discountValue / 100
                    : ""
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Minimum order (₹)</span>
              <input
                name="minRupees"
                type="number"
                min="0"
                step="1"
                defaultValue={editing ? editing.minOrderPaise / 100 : 0}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Max discount (₹, optional)</span>
              <input
                name="maxRupees"
                type="number"
                min="1"
                step="1"
                defaultValue={
                  editing?.maxDiscountPaise
                    ? editing.maxDiscountPaise / 100
                    : ""
                }
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Expires (optional)</span>
              <input
                name="expiresAt"
                type="date"
                defaultValue={
                  editing?.expiresAt
                    ? editing.expiresAt.slice(0, 10)
                    : ""
                }
                className={inputClass}
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm font-medium text-fg">
            <input
              name="active"
              type="checkbox"
              defaultChecked={editing?.active ?? true}
              className="h-4 w-4 accent-accent"
            />
            Active
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-fg-muted transition hover:text-fg"
            >
              Cancel
            </button>
            <button
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : null}
              {editingId ? "Save changes" : "Create coupon"}
            </button>
          </div>
        </form>
      ) : null}

      {coupons.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-fg-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">
                  Min order
                </th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">
                  Used
                </th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="bg-surface">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
                      <Tag size={13} className="text-accent" />
                      {coupon.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {coupon.discountType === "percent"
                      ? `${coupon.discountValue}%`
                      : formatInr(coupon.discountValue)}
                    {coupon.maxDiscountPaise
                      ? ` (max ${formatInr(coupon.maxDiscountPaise)})`
                      : ""}
                  </td>
                  <td className="hidden px-4 py-3 text-fg-muted sm:table-cell">
                    {coupon.minOrderPaise
                      ? formatInr(coupon.minOrderPaise)
                      : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-fg-muted sm:table-cell">
                    {coupon.usageCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        coupon.active
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-surface-2 text-fg-subtle"
                      }`}
                    >
                      {coupon.active ? "Active" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(coupon)}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(coupon.id)}
                        disabled={busyId === coupon.id}
                        aria-label="Delete coupon"
                        className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                      >
                        {busyId === coupon.id ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <Tag className="mx-auto text-fg-subtle" size={30} />
          <p className="mt-3 text-sm text-fg-muted">
            No coupons yet. Create one to offer discounts at checkout.
          </p>
        </div>
      )}
    </div>
  );
}
