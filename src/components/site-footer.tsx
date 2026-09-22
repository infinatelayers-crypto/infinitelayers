"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera, Layers, Mail, MessageCircle } from "lucide-react";

export function SiteFooter({
  instagramUrl,
  aboutText,
  whatsappNumber,
  showWhatsapp,
  supportEmail,
  showEmail,
}: {
  instagramUrl: string;
  aboutText: string;
  whatsappNumber: string;
  showWhatsapp: boolean;
  supportEmail: string;
  showEmail: boolean;
}) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  const whatsappVisible = showWhatsapp && whatsappNumber.length >= 10;
  const emailVisible = showEmail && supportEmail.includes("@");

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border bg-bg-subtle">
      <div className="bp-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-accent-fg">
                <Layers className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <p className="font-display text-lg font-bold text-fg">
                Infinite Layers
              </p>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-fg-muted">
              {aboutText}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-fg-muted transition hover:border-accent/40 hover:text-fg"
              >
                <Camera className="h-4 w-4" /> Instagram
              </a>
              {whatsappVisible ? (
                <a
                  href={`https://wa.me/${whatsappNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-fg-muted transition hover:border-accent/40 hover:text-fg"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              ) : null}
              {emailVisible ? (
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-fg-muted transition hover:border-accent/40 hover:text-fg"
                >
                  <Mail className="h-4 w-4" /> Email
                </a>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">
                Explore
              </p>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link href="/shop" className="text-fg-muted transition hover:text-accent">
                    Shop all
                  </Link>
                </li>
                <li>
                  <Link href="/shop?featured=1" className="text-fg-muted transition hover:text-accent">
                    Featured
                  </Link>
                </li>
                <li>
                  <Link href="/checkout" className="text-fg-muted transition hover:text-accent">
                    Cart
                  </Link>
                </li>
                <li>
                  <Link href="/track" className="text-fg-muted transition hover:text-accent">
                    Track order
                  </Link>
                </li>
                <li>
                  <Link href="/help" className="text-fg-muted transition hover:text-accent">
                    Help &amp; support
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-fg-subtle">
                Studio
              </p>
              <ul className="mt-4 space-y-3 text-sm text-fg-muted">
                <li>Made to order</li>
                <li>Ships across India</li>
                <li>Custom requests via DM</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Infinite Layers. All rights reserved.</p>
          <p>Crafted in India · Precision 3D printing</p>
        </div>
      </div>
    </footer>
  );
}
