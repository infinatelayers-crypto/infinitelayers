/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductVisual } from "./product-visual";

export function ProductCardMedia({ product }: { product: Product }) {
  const images = product.imageUrls ?? [];
  const [index, setIndex] = useState(0);
  const hasMultiple = images.length > 1;

  function move(event: React.MouseEvent, direction: -1 | 1) {
    // The card is a link; don't navigate when flipping photos.
    event.preventDefault();
    event.stopPropagation();
    setIndex((current) => (current + direction + images.length) % images.length);
  }

  if (!images.length) {
    return (
      <ProductVisual
        product={product}
        className="transition duration-700 group-hover:scale-105"
      />
    );
  }

  return (
    <>
      <img
        src={images[index] ?? images[0]}
        alt={`${product.name}${hasMultiple ? ` — photo ${index + 1}` : ""}`}
        className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
      />

      {hasMultiple ? (
        <>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/90 backdrop-blur">
            <Images size={11} /> {index + 1}/{images.length}
          </span>

          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => move(e, -1)}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white opacity-0 backdrop-blur transition hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => move(e, 1)}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white opacity-0 backdrop-blur transition hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronRight size={16} />
          </button>

          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {images.map((image, dotIndex) => (
              <span
                key={image}
                className={`h-1.5 rounded-full transition-all ${
                  dotIndex === index ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
