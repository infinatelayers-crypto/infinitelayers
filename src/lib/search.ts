import type { Product } from "./types";

export function filterProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.details.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
  );
}
