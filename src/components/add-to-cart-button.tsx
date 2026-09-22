"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import type { Product } from "@/lib/types";

export function AddToCartButton({ product }: { product: Product }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      disabled={!product.inStock}
      className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        added
          ? "bg-emerald-500 text-white"
          : "bg-accent text-accent-fg hover:bg-accent-hover"
      }`}
    >
      {added ? (
        <>
          <Check className="h-4 w-4" /> Added to cart
        </>
      ) : (
        <>
          <ShoppingBag className="h-4 w-4" />
          {product.inStock ? "Add to cart" : "Out of stock"}
        </>
      )}
    </button>
  );
}
