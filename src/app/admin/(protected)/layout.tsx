import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  ExternalLink,
  LifeBuoy,
  LogOut,
  PackageCheck,
  Settings,
  Star,
  Tag,
} from "lucide-react";
import { logoutAction } from "../actions";
import { requireAdmin } from "@/lib/admin/auth";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Boxes },
  { href: "/admin/orders", label: "Bookings", icon: PackageCheck },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-bg">
      <div className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-4">
            <Link href="/admin" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-accent-fg">
                <Boxes className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <div className="leading-tight">
                <p className="font-display text-sm font-bold text-fg">
                  Control room
                </p>
                <p className="text-[11px] text-fg-subtle">{admin.email}</p>
              </div>
            </Link>
            <ThemeToggle className="lg:hidden" />
          </div>

          <nav
            className="flex flex-wrap items-center gap-2"
            aria-label="Admin navigation"
          >
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-fg-muted transition hover:border-accent/40 hover:text-fg"
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-fg-muted transition hover:text-fg"
            >
              View store <ExternalLink size={14} />
            </Link>
            <ThemeToggle className="hidden lg:inline-flex" />
            <form action={logoutAction}>
              <button className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-300">
                <LogOut size={15} /> Sign out
              </button>
            </form>
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
