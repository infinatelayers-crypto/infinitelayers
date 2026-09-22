import Link from "next/link";
import { ArrowLeft, Check, MessageCircle, PackageCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { BuyNowButton } from "@/components/buy-now-button";
import { ProductGallery } from "@/components/product-gallery";
import { formatInr } from "@/lib/format";
import { getProductBySlug } from "@/lib/products";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const detailLines = product.details
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-sm text-fg-muted transition hover:text-accent"
      >
        <ArrowLeft size={15} /> Back to shop
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
        <ProductGallery key={product.id} product={product} />

        <div className="flex flex-col lg:sticky lg:top-28">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
              {product.category}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                product.inStock
                  ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
                  : "bg-surface-2 text-fg-subtle"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  product.inStock ? "bg-emerald-500" : "bg-fg-subtle"
                }`}
              />
              {product.inStock ? "Available to order" : "Currently unavailable"}
            </span>
          </div>

          <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-fg sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-2xl font-bold text-fg">
            {formatInr(product.pricePaise)}
          </p>
          <p className="mt-6 text-base leading-7 text-fg-muted">
            {product.description}
          </p>

          {detailLines.length ? (
            <div className="mt-7 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <h2 className="font-display text-sm font-semibold text-fg">
                Product details
              </h2>
              <ul className="mt-3 space-y-2.5">
                {detailLines.map((line) => (
                  <li
                    key={line}
                    className="flex items-start gap-2.5 text-sm leading-6 text-fg-muted"
                  >
                    <Check size={14} className="mt-1 shrink-0 text-accent" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 grid gap-3 text-sm text-fg-muted sm:grid-cols-2">
            <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3.5">
              <PackageCheck size={16} className="mt-0.5 shrink-0 text-fg-subtle" />
              Handmade and checked before dispatch
            </p>
            <p className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3.5">
              <MessageCircle size={16} className="mt-0.5 shrink-0 text-fg-subtle" />
              Custom sizing confirmed on WhatsApp
            </p>
          </div>

          <div className="mt-8 max-w-md">
            <div className="grid gap-3 sm:grid-cols-2">
              <AddToCartButton product={product} />
              <BuyNowButton product={product} />
            </div>
            <p className="mt-3 text-center text-xs leading-5 text-fg-subtle">
              No account needed. Phone and delivery address are requested only at
              checkout.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
