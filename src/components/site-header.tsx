"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "@/context/cart-context";
import { ThemeToggle } from "./theme-toggle";

const NAV_LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?featured=1", label: "Featured" },
  { href: "/track", label: "Track order" },
];

export function SiteHeader({ instagramUrl }: { instagramUrl: string }) {
  const { count } = useCart();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Admin has its own chrome.
  if (pathname?.startsWith("/admin")) return null;

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border bg-bg/80 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-accent-fg shadow-lg shadow-accent/25 transition-transform duration-300 group-hover:-rotate-6">
            <Layers className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold tracking-wide text-fg">
              Infinite Layers
            </p>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-fg-subtle">
              3D Print Studio
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-fg-muted md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="link-underline transition hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline inline-flex items-center gap-1 transition hover:text-fg"
          >
            Instagram ↗
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/checkout"
            className="group relative inline-flex h-10 items-center gap-2 rounded-full bg-fg px-4 text-sm font-semibold text-bg transition hover:opacity-90"
          >
            <ShoppingBag className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
            <span className="hidden sm:inline">Cart</span>
            {count > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-fg-muted transition hover:text-fg md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`overflow-hidden border-border bg-bg/95 backdrop-blur-xl transition-[max-height,opacity] duration-300 md:hidden ${
          menuOpen ? "max-h-72 border-b opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMenu}
              className="rounded-xl px-4 py-3 text-base font-medium text-fg-muted transition hover:bg-surface-hover hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeMenu}
            className="rounded-xl px-4 py-3 text-base font-medium text-fg-muted transition hover:bg-surface-hover hover:text-fg"
          >
            Instagram ↗
          </a>
          <div className="mt-2 flex items-center justify-between rounded-xl bg-surface px-4 py-2.5">
            <span className="text-sm font-medium text-fg-muted">Appearance</span>
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
}
