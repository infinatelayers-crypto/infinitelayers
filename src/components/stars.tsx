import { Star } from "lucide-react";

export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={
            n <= rating ? "fill-accent text-accent" : "fill-transparent text-border-strong"
          }
        />
      ))}
    </div>
  );
}
