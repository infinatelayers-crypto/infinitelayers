import Link from "next/link";
import { formatInr } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductVisual } from "./product-visual";
import { QuickAddButton } from "./quick-add-button";

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-card-lg">
      <Link
        href={`/product/${product.slug}`}
        className="relative block aspect-[4/5] overflow-hidden"
      >
        <ProductVisual
          product={product}
          className="transition duration-700 group-hover:scale-105"
        />
        {!product.inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-fg/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-bg backdrop-blur">
            Sold out
          </span>
        ) : product.featured ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-fg">
            Featured
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          {product.category}
        </p>
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-display text-base font-semibold leading-snug text-fg transition group-hover:text-accent">
            {product.name}
          </h3>
        </Link>
        <p className="line-clamp-2 text-sm text-fg-muted">
          {product.description}
        </p>

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="font-display text-lg font-bold text-fg">
            {formatInr(product.pricePaise)}
          </p>
          <QuickAddButton product={product} />
        </div>
      </div>
    </div>
  );
}
