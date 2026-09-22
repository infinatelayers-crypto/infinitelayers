import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/admin/auth";

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-2 text-sm font-semibold text-fg-subtle transition hover:text-fg"
      >
        <ArrowLeft size={16} /> Back to products
      </Link>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          New catalog item
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-fg">
          Add a product
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Add the product information first, then upload up to six photos.
        </p>
      </header>
      <ProductForm />
    </div>
  );
}
