"use client";

import { AlertCircle, Check, LoaderCircle, Save } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSettingsAction } from "@/app/admin/actions";
import type { StoreSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: StoreSettings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    setError(undefined);
    setSaved(false);

    const deliveryRupees = Number(formData.get("deliveryRupees"));
    const freeOverRupees = Number(formData.get("freeOverRupees"));

    const result = await saveSettingsAction({
      heroBadge: String(formData.get("heroBadge") ?? ""),
      heroTitle: String(formData.get("heroTitle") ?? ""),
      heroSubtitle: String(formData.get("heroSubtitle") ?? ""),
      aboutText: String(formData.get("aboutText") ?? ""),
      instagramUrl: String(formData.get("instagramUrl") ?? ""),
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      deliveryFeePaise: Number.isFinite(deliveryRupees)
        ? Math.round(deliveryRupees * 100)
        : 0,
      freeDeliveryOverPaise: Number.isFinite(freeOverRupees)
        ? Math.round(freeOverRupees * 100)
        : 0,
      supportEmail: String(formData.get("supportEmail") ?? ""),
      supportFormUrl: String(formData.get("supportFormUrl") ?? ""),
      feedbackFormUrl: String(formData.get("feedbackFormUrl") ?? ""),
      showWhatsapp: formData.get("showWhatsapp") === "on",
      showEmail: formData.get("showEmail") === "on",
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? "Could not save settings.");
      return;
    }
    setSaved(true);
    router.refresh();
    window.setTimeout(() => setSaved(false), 2500);
  }

  const inputClass =
    "w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring";
  const labelClass = "mb-2 block text-sm font-semibold text-fg";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <p className="font-display text-lg font-semibold text-fg">
          Landing page content
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          Shown on the homepage hero. Changes appear on the store after saving.
        </p>
        <div className="mt-6 space-y-5">
          <label className="block">
            <span className={labelClass}>Badge text</span>
            <input
              name="heroBadge"
              maxLength={120}
              defaultValue={settings.heroBadge}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Hero title</span>
            <input
              name="heroTitle"
              required
              minLength={3}
              maxLength={160}
              defaultValue={settings.heroTitle}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Hero subtitle</span>
            <textarea
              name="heroSubtitle"
              rows={3}
              maxLength={400}
              defaultValue={settings.heroSubtitle}
              className={`${inputClass} resize-y`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>About / footer blurb</span>
            <textarea
              name="aboutText"
              rows={3}
              maxLength={600}
              defaultValue={settings.aboutText}
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <p className="font-display text-lg font-semibold text-fg">Contact links</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Instagram URL</span>
            <input
              name="instagramUrl"
              type="url"
              defaultValue={settings.instagramUrl}
              placeholder="https://www.instagram.com/your_handle/"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>WhatsApp number (optional)</span>
            <input
              name="whatsappNumber"
              inputMode="numeric"
              defaultValue={settings.whatsappNumber}
              placeholder="919xxxxxxxxx"
              className={inputClass}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-fg-muted">
              <input
                name="showWhatsapp"
                type="checkbox"
                defaultChecked={settings.showWhatsapp}
                className="h-4 w-4 accent-accent"
              />
              Show WhatsApp in the site footer
            </label>
          </label>
          <label className="block">
            <span className={labelClass}>Support email (optional)</span>
            <input
              name="supportEmail"
              type="email"
              defaultValue={settings.supportEmail}
              placeholder="hello@yourstore.com"
              className={inputClass}
            />
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-fg-muted">
              <input
                name="showEmail"
                type="checkbox"
                defaultChecked={settings.showEmail}
                className="h-4 w-4 accent-accent"
              />
              Show email in the site footer
            </label>
          </label>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Support form URL (Formspree)</span>
            <input
              name="supportFormUrl"
              type="url"
              defaultValue={settings.supportFormUrl}
              placeholder="https://formspree.io/f/xxxxxxx"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Feedback form URL (Formspree)</span>
            <input
              name="feedbackFormUrl"
              type="url"
              defaultValue={settings.feedbackFormUrl}
              placeholder="https://formspree.io/f/xxxxxxx"
              className={inputClass}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">
          Support and review submissions are always saved in the admin. If you
          add Formspree URLs, a copy is also emailed to you.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <p className="font-display text-lg font-semibold text-fg">
          Delivery charges
        </p>
        <p className="mt-1 text-xs text-fg-subtle">
          Set a flat delivery fee, and optionally make it free above a cart
          value. Set both to 0 for always-free delivery.
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Delivery fee (₹)</span>
            <input
              name="deliveryRupees"
              type="number"
              min="0"
              step="1"
              defaultValue={settings.deliveryFeePaise / 100}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Free delivery over (₹, 0 = off)</span>
            <input
              name="freeOverRupees"
              type="number"
              min="0"
              step="1"
              defaultValue={settings.freeDeliveryOverPaise / 100}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <Check size={16} /> Saved
          </span>
        ) : null}
        <button
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? (
            <LoaderCircle size={17} className="animate-spin" />
          ) : (
            <Save size={17} />
          )}
          Save settings
        </button>
      </div>
    </form>
  );
}
