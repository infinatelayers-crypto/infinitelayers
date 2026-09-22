"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { filterProducts } from "@/lib/search";
import type { Product } from "@/lib/types";
import { ProductCard } from "./product-card";

type Props = {
  products: Product[];
  initialQuery?: string;
  featuredOnly?: boolean;
};

export function ShopExplorer({
  products,
  initialQuery = "",
  featuredOnly = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);

  const scoped = useMemo(
    () => (featuredOnly ? products.filter((p) => p.featured) : products),
    [products, featuredOnly],
  );

  const categories = useMemo(
    () => Array.from(new Set(scoped.map((p) => p.category))).sort(),
    [scoped],
  );

  const visible = useMemo(
    () => filterProducts(scoped, query),
    [scoped, query],
  );

  return (
    <div className="space-y-8">
      <div className="relative mx-auto max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search helmets, lamps, cosplay…"
          className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-11 text-base text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
          aria-label="Search products"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-subtle transition hover:bg-surface-hover hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {categories.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setQuery((current) =>
                  current.toLowerCase() === category.toLowerCase()
                    ? ""
                    : category,
                )
              }
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                query.toLowerCase() === category.toLowerCase()
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-border bg-surface text-fg-muted hover:border-accent/40 hover:text-fg"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-center text-sm text-fg-subtle">
        {visible.length} product{visible.length === 1 ? "" : "s"}
        {query ? ` for “${query}”` : ""}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center text-fg-muted">
          No matches — try another keyword or{" "}
          <button
            type="button"
            className="font-semibold text-accent underline-offset-2 hover:underline"
            onClick={() => setQuery("")}
          >
            clear search
          </button>
          .
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
