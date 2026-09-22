import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProduct } from "@/lib/admin/data";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

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
          Edit catalog item
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-fg">
          {product.name}
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Changes are reflected on the storefront after you save.
        </p>
      </header>
      <ProductForm product={product} />
    </div>
  );
}
