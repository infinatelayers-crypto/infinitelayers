"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ExternalLink,
  LifeBuoy,
  LogOut,
  Menu,
  PackageCheck,
  Settings,
  Star,
  Tag,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/orders", label: "Bookings", icon: PackageCheck },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  email,
  logoutAction,
  children,
}: {
  email: string;
  logoutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeDrawer = () => setOpen(false);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-accent-fg">
            <Boxes className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-bold text-fg">Control room</p>
            <p className="max-w-40 truncate text-[11px] text-fg-subtle">{email}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-fg-muted transition hover:bg-surface-hover lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3" aria-label="Admin navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            onClick={closeDrawer}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
              isActive(href, exact)
                ? "bg-accent-soft text-accent"
                : "text-fg-muted hover:bg-surface-hover hover:text-fg"
            }`}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="space-y-1 border-t border-border px-3 py-3">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg"
        >
          <ExternalLink size={16} /> View store
        </Link>
        <div className="flex items-center justify-between rounded-xl px-3.5 py-2">
          <span className="text-sm font-semibold text-fg-muted">Appearance</span>
          <ThemeToggle />
        </div>
        <form action={logoutAction}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500">
            <LogOut size={16} /> Sign out
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-fg-muted transition hover:text-fg"
        >
          <Menu size={20} />
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-hover text-accent-fg">
            <Boxes className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <span className="font-display text-sm font-bold text-fg">
            Control room
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Mobile drawer + overlay */}
      {open ? (
        <button
          type="button"
          aria-label="Close menu overlay"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] border-r border-border bg-surface shadow-card-lg transition-transform duration-300 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
