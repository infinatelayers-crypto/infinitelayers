"use client";

import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import type { Product } from "@/lib/types";

export function QuickAddButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd(event: React.MouseEvent) {
    // The card is a link; don't navigate when tapping the add control.
    event.preventDefault();
    event.stopPropagation();
    if (!product.inStock) return;
    addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  if (!product.inStock) {
    return (
      <span className="inline-flex h-9 items-center rounded-full bg-surface-2 px-3 text-xs font-semibold text-fg-subtle">
        Sold out
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-label={`Add ${product.name} to cart`}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition ${
        added
          ? "bg-emerald-500 text-white"
          : "bg-accent text-accent-fg hover:bg-accent-hover"
      }`}
    >
      {added ? (
        <>
          <Check className="h-3.5 w-3.5" /> Added
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5" /> Add
        </>
      )}
    </button>
  );
}
