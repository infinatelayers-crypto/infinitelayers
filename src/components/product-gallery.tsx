/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductVisual } from "./product-visual";

type GalleryProduct = Pick<
  Product,
  "name" | "category" | "imageUrl" | "imageUrls"
>;

export function ProductGallery({ product }: { product: GalleryProduct }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const images = product.imageUrls;

  if (!images.length) {
    return (
      <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-border">
        <ProductVisual product={product} />
      </div>
    );
  }

  const selectedImage = images[selectedIndex] ?? images[0];

  function move(direction: -1 | 1) {
    setSelectedIndex((current) =>
      (current + direction + images.length) % images.length,
    );
  }

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-surface-2">
        <img
          src={selectedImage}
          alt={`${product.name} — view ${selectedIndex + 1}`}
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/55 to-transparent" />
        <span className="absolute bottom-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur">
          <Images size={13} /> {selectedIndex + 1} / {images.length}
        </span>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous product photo"
              onClick={() => move(-1)}
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white opacity-100 backdrop-blur transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label="Next product photo"
              onClick={() => move(1)}
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white opacity-100 backdrop-blur transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <ChevronRight size={20} />
            </button>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="grid grid-cols-6 gap-2" aria-label="Product photos">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              aria-label={`Show product photo ${index + 1}`}
              aria-pressed={selectedIndex === index}
              onClick={() => setSelectedIndex(index)}
              className={`aspect-square overflow-hidden rounded-xl border bg-surface-2 transition ${
                selectedIndex === index
                  ? "border-accent ring-2 ring-ring"
                  : "border-border opacity-55 hover:opacity-100"
              }`}
            >
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
