import { LockKeyhole, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { loginAction } from "../actions";
import { getAdminIdentity } from "@/lib/admin/auth";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  configuration: "Supabase is not configured for this deployment.",
  credentials: "Email or password is incorrect.",
  unauthorized: "This account is not approved as a store administrator.",
  throttled:
    "Too many failed attempts. Please wait 15 minutes and try again.",
};

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const [admin, query] = await Promise.all([
    getAdminIdentity(),
    searchParams,
  ]);
  if (admin) redirect("/admin");

  const error = query.error ? ERROR_MESSAGES[query.error] : undefined;

  return (
    <section className="relative isolate flex min-h-screen items-center overflow-hidden px-4 py-20 sm:px-6">
      <div className="bp-grid pointer-events-none absolute inset-0 opacity-50" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 45% at 50% 10%, var(--hero-glow), transparent 60%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-border bg-surface p-6 shadow-2xl sm:p-8">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg">
          <LockKeyhole size={22} />
        </div>
        <div className="mb-8">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-accent">
            <Sparkles size={14} /> Infinite Layers
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
            Store control room
          </h1>
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            Sign in with the private admin account to manage products, photos,
            bookings, and sales activity.
          </p>
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <form action={loginAction} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-fg">
              Email
            </span>
            <input
              required
              autoComplete="email"
              inputMode="email"
              name="email"
              type="email"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-4 focus:ring-ring"
              placeholder="Enter your admin email"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-fg">
              Password
            </span>
            <input
              required
              minLength={6}
              autoComplete="current-password"
              name="password"
              type="password"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/60 focus:ring-4 focus:ring-ring"
              placeholder="Enter your password"
            />
          </label>
          <button className="w-full rounded-xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover">
            Sign in to admin
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-fg-subtle">
          There is no public sign-up. Admin access is approved in Supabase.
        </p>
      </div>
    </section>
  );
}
