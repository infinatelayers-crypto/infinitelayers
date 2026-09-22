import { createPublicSupabase } from "./supabase/public";
import type { Review } from "./types";

type DbReview = {
  id: string;
  name: string;
  rating: number;
  message: string;
  approved: boolean;
  featured: boolean;
  created_at: string;
};

export function mapReview(row: DbReview): Review {
  return {
    id: row.id,
    name: row.name,
    rating: row.rating,
    message: row.message,
    approved: row.approved,
    featured: row.featured,
    createdAt: row.created_at,
  };
}

/** Approved + featured reviews for the homepage. RLS only exposes approved rows. */
export async function getFeaturedReviews(limit = 6): Promise<Review[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("approved", true)
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as DbReview[]).map(mapReview);
}
