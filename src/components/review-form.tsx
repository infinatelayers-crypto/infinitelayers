"use client";

import { Check, LoaderCircle, Star } from "lucide-react";
import { useState } from "react";

export function ReviewForm() {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("Please pick a star rating.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rating, message }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "Could not submit your review.");
        return;
      }
      setDone(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
          <Check size={22} strokeWidth={3} />
        </div>
        <p className="mt-3 font-display text-lg font-semibold text-fg">
          Thanks for the feedback!
        </p>
        <p className="mt-1 text-sm text-fg-muted">
          Your review is submitted. We show selected reviews on our homepage.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-fg">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={60}
            className="h-11 w-full rounded-xl border border-border bg-bg px-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            placeholder="Enter your name"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-fg">Rating</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                className="p-0.5"
              >
                <Star
                  size={26}
                  className={
                    n <= (hover || rating)
                      ? "fill-accent text-accent"
                      : "fill-transparent text-border-strong"
                  }
                />
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-fg">
            Your review
          </span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={4}
            maxLength={800}
            rows={4}
            className="w-full resize-y rounded-xl border border-border bg-bg px-3 py-2.5 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50 focus:ring-4 focus:ring-ring"
            placeholder="Write your review"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <button
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-bold text-accent-fg transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : null}
          Submit review
        </button>
      </div>
    </form>
  );
}
