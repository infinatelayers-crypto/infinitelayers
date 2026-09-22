import { Camera, Mail, MessageCircle, PackageSearch } from "lucide-react";
import Link from "next/link";
import { ReviewForm } from "@/components/review-form";
import { SupportForm } from "@/components/support-form";
import { getStoreSettings } from "@/lib/settings";

export const metadata = {
  title: "Help & support",
};

export default async function HelpPage() {
  const settings = await getStoreSettings();
  const whatsappLink = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}`
    : null;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56"
        style={{
          background:
            "radial-gradient(50% 100% at 50% 0%, var(--hero-glow), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            We&apos;re here to help
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Help &amp; support
          </h1>
          <p className="mt-3 text-fg-muted">
            Questions about an order, custom request, or sizing? Reach out below.
          </p>
        </div>

        {/* Quick contact */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <MessageCircle size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">WhatsApp</p>
                <p className="text-xs text-fg-subtle">Fastest reply</p>
              </div>
            </a>
          ) : null}
          {settings.instagramUrl ? (
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Camera size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">Instagram</p>
                <p className="text-xs text-fg-subtle">DM us anytime</p>
              </div>
            </a>
          ) : null}
          {settings.showEmail && settings.supportEmail ? (
            <a
              href={`mailto:${settings.supportEmail}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Mail size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-fg">Email</p>
                <p className="truncate text-xs text-fg-subtle">
                  {settings.supportEmail}
                </p>
              </div>
            </a>
          ) : null}
        </div>

        <div className="mt-6">
          <Link
            href="/track"
            className="inline-flex items-center gap-2 rounded-xl border border-border-strong px-4 py-2.5 text-sm font-semibold text-fg transition hover:bg-surface-hover"
          >
            <PackageSearch size={16} /> Track an existing order
          </Link>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-xl font-semibold text-fg">
              Contact support
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Send a message and we&apos;ll get back to you.
            </p>
            <div className="mt-4">
              <SupportForm />
            </div>
          </div>

          <div id="review" className="scroll-mt-24">
            <h2 className="font-display text-xl font-semibold text-fg">
              Leave a review
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              Tell us about your experience — selected reviews appear on our
              homepage.
            </p>
            <div className="mt-4">
              <ReviewForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
