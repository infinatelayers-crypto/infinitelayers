import Link from "next/link";
import { ArrowUpRight, ImageIcon, Plus } from "lucide-react";
import { ProductVisual } from "@/components/product-visual";
import { getAdminProducts } from "@/lib/admin/data";
import { formatInr } from "@/lib/format";

function formatUpdatedAt(value?: string) {
  if (!value) return "Not edited yet";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminProductsPage() {
  const products = await getAdminProducts();

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Catalog
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-fg">
            Products
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            Manage details, pricing, availability, and up to six photos per item.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg transition hover:bg-accent-hover"
        >
          <Plus size={17} /> Add product
        </Link>
      </header>

      {products.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="group overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="flex gap-4 p-4">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                  <ProductVisual product={product} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-accent">
                        {product.category}
                      </p>
                      <h2 className="mt-1 truncate font-display font-semibold text-fg">
                        {product.name}
                      </h2>
                    </div>
                    <span
                      className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                        product.inStock ? "bg-emerald-500" : "bg-fg-subtle"
                      }`}
                      title={product.inStock ? "In stock" : "Unavailable"}
                    />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-fg">
                    {formatInr(product.pricePaise)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
                    <ImageIcon size={12} /> {product.imageUrls.length}/6 photos
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-[11px] text-fg-subtle">
                  Updated {formatUpdatedAt(product.updatedAt)}
                </p>
                <Link
                  href={`/admin/products/${product.id}/edit`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-fg-muted transition group-hover:text-accent-hover"
                >
                  Edit <ArrowUpRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="rounded-3xl border border-dashed border-border bg-surface px-6 py-20 text-center">
          <ImageIcon className="mx-auto text-fg-subtle" size={32} />
          <h2 className="mt-4 font-display text-xl font-semibold text-fg">
            Your catalog is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-fg-subtle">
            Add the first product with its details, price, availability, and photo gallery.
          </p>
          <Link
            href="/admin/products/new"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-fg"
          >
            <Plus size={17} /> Create first product
          </Link>
        </section>
      )}
    </div>
  );
}
