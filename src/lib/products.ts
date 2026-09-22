import { demoProducts } from "./demo-products";
import { createPublicSupabase } from "./supabase/public";
import type { Product } from "./types";

export type DbProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  details?: string | null;
  price_paise: number;
  image_url: string | null;
  image_urls?: string[] | null;
  category: string;
  featured: boolean;
  in_stock: boolean;
  created_at?: string;
  updated_at?: string;
};

function demoCatalogEnabled(): boolean {
  return process.env.ENABLE_DEMO_CATALOG === "true";
}

export function mapProductRow(row: DbProduct): Product {
  const imageUrls = Array.from(
    new Set([...(row.image_urls ?? []), ...(row.image_url ? [row.image_url] : [])]),
  ).slice(0, 6);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    details: row.details ?? "",
    pricePaise: row.price_paise,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    category: row.category,
    featured: row.featured,
    inStock: row.in_stock,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchFromSupabase(): Promise<Product[] | null> {
  const supabase = createPublicSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load products from Supabase:", error.message);
    return null;
  }

  return (data as DbProduct[]).map(mapProductRow);
}

export async function getProducts(): Promise<Product[]> {
  const remote = await fetchFromSupabase();
  if (remote) return remote;
  return demoCatalogEnabled() ? demoProducts : [];
}

export async function getProductBySlug(
  slug: string,
): Promise<Product | undefined> {
  const supabase = createPublicSupabase();
  if (!supabase) {
    return demoCatalogEnabled()
      ? demoProducts.find((product) => product.slug === slug)
      : undefined;
  }

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Could not load product from Supabase:", error.message);
    return demoCatalogEnabled()
      ? demoProducts.find((product) => product.slug === slug)
      : undefined;
  }

  return data ? mapProductRow(data as DbProduct) : undefined;
}
