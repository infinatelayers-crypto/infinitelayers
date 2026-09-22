"use client";

import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import type { Product } from "@/lib/types";

export function BuyNowButton({
  product,
  className = "",
}: {
  product: Product;
  className?: string;
}) {
  const { addItem } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function handleBuyNow() {
    if (!product.inStock) return;
    setBusy(true);
    addItem(product);
    router.push("/checkout");
  }

  return (
    <button
      type="button"
      onClick={handleBuyNow}
      disabled={!product.inStock || busy}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border-strong bg-surface text-sm font-semibold text-fg transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <Zap className="h-4 w-4" />
      {product.inStock ? "Buy now" : "Unavailable"}
    </button>
  );
}
