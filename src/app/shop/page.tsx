import { ShopExplorer } from "@/components/shop-explorer";
import { getProducts } from "@/lib/products";

type Props = {
  searchParams: Promise<{ q?: string; featured?: string }>;
};

export default async function ShopPage({ searchParams }: Props) {
  const params = await searchParams;
  const products = await getProducts();
  const featuredOnly = params.featured === "1";

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64"
        style={{
          background:
            "radial-gradient(50% 100% at 50% 0%, var(--hero-glow), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {featuredOnly ? "Highlights" : "Catalog"}
          </p>
          <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
            {featuredOnly ? "Featured prints" : "The shop"}
          </h1>
          <p className="mt-3 text-fg-muted">
            Search cosplay, collectibles, and custom builds — add to cart
            anytime, sign in never.
          </p>
        </div>
        <div className="mt-12">
          <ShopExplorer
            products={products}
            initialQuery={params.q ?? ""}
            featuredOnly={featuredOnly}
          />
        </div>
      </div>
    </div>
  );
}
