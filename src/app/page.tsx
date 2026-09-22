import Link from "next/link";
import { ArrowRight, PackageCheck, Palette, Sparkles, Truck } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { Stars } from "@/components/stars";
import { getProducts } from "@/lib/products";
import { getStoreSettings } from "@/lib/settings";
import { getFeaturedReviews } from "@/lib/reviews";

// Highlight "3D" (case-insensitive) with the accent gradient if present.
function renderHeroTitle(title: string) {
  const match = title.match(/3d/i);
  if (!match || match.index === undefined) return title;
  const before = title.slice(0, match.index);
  const word = title.slice(match.index, match.index + 2);
  const after = title.slice(match.index + 2);
  return (
    <>
      {before}
      <span className="text-gradient">{word}</span>
      {after}
    </>
  );
}

export default async function HomePage() {
  const [products, settings, reviews] = await Promise.all([
    getProducts(),
    getStoreSettings(),
    getFeaturedReviews(6),
  ]);
  const featured = products.filter((p) => p.featured);
  const heroProducts = (featured.length ? featured : products).slice(0, 8);
  const categories = Array.from(new Set(products.map((p) => p.category)));

  return (
    <>
      {/* Compact, shop-first hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 60% at 50% -10%, var(--hero-glow), transparent 70%)",
          }}
        />
        <div className="bp-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-semibold text-fg-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {settings.heroBadge}
          </span>
          <h1 className="font-display mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-fg sm:text-6xl">
            {renderHeroTitle(settings.heroTitle)}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-fg-muted">
            {settings.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/shop"
              className="group inline-flex h-12 items-center gap-2 rounded-full bg-accent px-7 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
            >
              Shop all products
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            {categories.slice(0, 3).map((category) => (
              <Link
                key={category}
                href={`/shop?q=${encodeURIComponent(category)}`}
                className="inline-flex h-12 items-center rounded-full border border-border-strong px-6 text-sm font-semibold text-fg transition hover:bg-surface-hover"
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Products lead the page */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              {featured.length ? "Bestsellers" : "The collection"}
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-fg sm:text-3xl">
              Shop the prints
            </h2>
          </div>
          <Link
            href="/shop"
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-accent"
          >
            View all
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {heroProducts.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {heroProducts.map((product, index) => (
              <Reveal key={product.id} delay={(index % 4) * 70}>
                <ProductCard product={product} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <p className="text-fg-muted">
              New prints are being added. Check back shortly.
            </p>
          </div>
        )}
      </section>

      {/* Trust strip */}
      <section className="border-t border-border bg-bg-subtle">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-3 sm:px-6">
          {[
            {
              icon: PackageCheck,
              title: "Made to order",
              body: "Each piece printed and finished by hand after you order.",
            },
            {
              icon: Palette,
              title: "Custom requests",
              body: "Send a photo or STL — we print it in high detail.",
            },
            {
              icon: Truck,
              title: "Ships across India",
              body: "Carefully packed and dispatched with tracking.",
            },
          ].map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 90}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 shadow-card"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <item.icon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display font-semibold text-fg">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {reviews.length ? (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              Loved by customers
            </p>
            <h2 className="font-display mt-2 text-2xl font-bold text-fg sm:text-3xl">
              What people say
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, index) => (
              <Reveal
                key={review.id}
                delay={(index % 3) * 80}
                className="flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-card"
              >
                <Stars rating={review.rating} />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-fg-muted">
                  “{review.message}”
                </blockquote>
                <figcaption className="mt-4 font-display text-sm font-semibold text-fg">
                  {review.name}
                </figcaption>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href="/help#review"
              className="text-sm font-semibold text-accent transition hover:text-accent-hover"
            >
              Leave your own review →
            </a>
          </div>
        </section>
      ) : null}

      {/* Custom CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="shadow-card-lg relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-12 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(50% 80% at 50% 0%, var(--hero-glow), transparent 70%)",
            }}
          />
          <div className="relative">
            <h2 className="font-display mx-auto max-w-2xl text-2xl font-bold text-fg sm:text-3xl">
              Want something made just for you?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-fg-muted">
              Custom figurines, photo lamps, and cosplay builds. Message us with
              your idea and we&apos;ll print it layer by layer.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop"
                className="inline-flex h-12 items-center rounded-full bg-accent px-7 text-sm font-semibold text-accent-fg transition hover:bg-accent-hover"
              >
                Start shopping
              </Link>
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center rounded-full border border-border-strong px-7 text-sm font-semibold text-fg transition hover:bg-surface-hover"
              >
                Message on Instagram
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
