"use client";

import { LoaderCircle, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteReviewAction,
  updateReviewAction,
} from "@/app/admin/actions";
import type { Review } from "@/lib/types";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={
            n <= rating ? "fill-accent text-accent" : "fill-transparent text-border-strong"
          }
        />
      ))}
    </div>
  );
}

export function ReviewsManager({ reviews }: { reviews: Review[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggle(id: string, changes: { approved?: boolean; featured?: boolean }) {
    setError(undefined);
    startTransition(async () => {
      const result = await updateReviewAction(id, changes);
      if (!result.ok) setError(result.error ?? "Could not update.");
      else router.refresh();
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this review?")) return;
    setBusyId(id);
    const result = await deleteReviewAction(id);
    setBusyId(null);
    if (!result.ok) setError(result.error ?? "Could not delete.");
    else router.refresh();
  }

  if (!reviews.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <Star className="mx-auto text-fg-subtle" size={30} />
        <p className="mt-3 text-sm text-fg-muted">
          No reviews yet. Customer reviews will appear here for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-2xl border border-border bg-surface p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display font-semibold text-fg">{review.name}</p>
              <div className="mt-1">
                <ReviewStars rating={review.rating} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {review.featured ? (
                <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                  On homepage
                </span>
              ) : review.approved ? (
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Approved
                </span>
              ) : (
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-fg-subtle">
                  Pending
                </span>
              )}
            </div>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            “{review.message}”
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(review.id, { approved: !review.approved })}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg disabled:opacity-50"
            >
              {review.approved ? "Unapprove" : "Approve"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(review.id, { featured: !review.featured })}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg disabled:opacity-50"
            >
              {review.featured ? "Remove from homepage" : "Show on homepage"}
            </button>
            <button
              type="button"
              disabled={busyId === review.id}
              onClick={() => remove(review.id)}
              aria-label="Delete review"
              className="ml-auto rounded-lg p-1.5 text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              {busyId === review.id ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
