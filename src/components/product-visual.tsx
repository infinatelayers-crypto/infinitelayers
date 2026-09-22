import type { Product } from "@/lib/types";

const palettes: Record<string, { from: string; to: string; ring: string }> = {
  Collectibles: {
    from: "#7c3aed",
    to: "#c026d3",
    ring: "rgba(192,38,211,0.35)",
  },
  Cosplay: {
    from: "#f59e0b",
    to: "#ea580c",
    ring: "rgba(245,158,11,0.35)",
  },
  Custom: {
    from: "#06b6d4",
    to: "#0d9488",
    ring: "rgba(6,182,212,0.35)",
  },
  general: {
    from: "#a1a1aa",
    to: "#52525b",
    ring: "rgba(161,161,170,0.3)",
  },
};

type Props = {
  product: Pick<Product, "name" | "category" | "imageUrl">;
  className?: string;
};

export function ProductVisual({ product, className = "" }: Props) {
  const palette = palettes[product.category] ?? palettes.general;

  if (product.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt={product.name}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  // Stylized "sliced layers" placeholder — reads as a 3D-print preview, not a stock gradient.
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 30% 10%, ${palette.from}22, transparent 55%), linear-gradient(160deg, var(--surface-2), var(--surface))`,
      }}
    >
      <div className="bp-grid absolute inset-0 opacity-70" />

      <svg
        viewBox="0 0 200 200"
        className="relative h-1/2 w-1/2 opacity-90"
        fill="none"
        aria-hidden
      >
        <defs>
          <linearGradient id={`g-${product.category}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={palette.from} />
            <stop offset="1" stopColor={palette.to} />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse
            key={i}
            cx="100"
            cy={70 + i * 20}
            rx={60 - i * 8}
            ry={16 - i * 1.5}
            stroke={`url(#g-${product.category})`}
            strokeWidth="2.5"
            opacity={1 - i * 0.14}
          />
        ))}
      </svg>

      <div
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-3xl"
        style={{ background: palette.ring }}
      />
      <p className="absolute bottom-4 left-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-fg-subtle">
        {product.category}
      </p>
    </div>
  );
}
