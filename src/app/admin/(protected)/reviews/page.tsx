import { ReviewsManager } from "@/components/admin/reviews-manager";
import { getAdminReviews } from "@/lib/admin/data";

export default async function AdminReviewsPage() {
  const reviews = await getAdminReviews();
  const pending = reviews.filter((r) => !r.approved).length;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Trust
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg">
          Reviews
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Approve reviews and choose which ones appear on your homepage.
          {pending > 0 ? ` ${pending} awaiting review.` : ""}
        </p>
      </header>
      <ReviewsManager reviews={reviews} />
    </div>
  );
}
