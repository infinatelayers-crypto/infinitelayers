/* eslint-disable @next/next/no-img-element */
"use client";

import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { ProductVisual } from "./product-visual";

export function ProductCardMedia({ product }: { product: Product }) {
  const router = useRouter();
  const images = product.imageUrls ?? [];
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const swiped = useRef(false);
  const hasMultiple = images.length > 1;
  const href = `/product/${product.slug}`;

  function step(direction: -1 | 1) {
    setIndex((current) => (current + direction + images.length) % images.length);
  }

  function onArrow(event: React.MouseEvent, direction: -1 | 1) {
    event.preventDefault();
    event.stopPropagation();
    step(direction);
  }

  function onTouchStart(event: React.TouchEvent) {
    startX.current = event.touches[0]?.clientX ?? null;
    startY.current = event.touches[0]?.clientY ?? null;
    swiped.current = false;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (startX.current === null) return;
    const dx = (event.touches[0]?.clientX ?? startX.current) - startX.current;
    const dy = (event.touches[0]?.clientY ?? (startY.current ?? 0)) - (startY.current ?? 0);
    // Horizontal intent → treat as a swipe (mark it so tap doesn't navigate).
    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
      swiped.current = true;
    }
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (startX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? startX.current;
    const delta = endX - startX.current;

    if (hasMultiple && Math.abs(delta) > 40) {
      step(delta < 0 ? 1 : -1);
      swiped.current = true;
    }
    startX.current = null;
    startY.current = null;
  }

  // Tap opens the product — but only if the gesture wasn't a swipe.
  function onClick() {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    router.push(href);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`View ${product.name}`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter") router.push(href);
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative block aspect-[4/5] cursor-pointer overflow-hidden"
    >
      {images.length ? (
        <img
          src={images[index] ?? images[0]}
          alt={`${product.name}${hasMultiple ? ` — photo ${index + 1}` : ""}`}
          draggable={false}
          className="h-full w-full select-none object-cover transition duration-700 group-hover:scale-105"
        />
      ) : (
        <ProductVisual
          product={product}
          className="transition duration-700 group-hover:scale-105"
        />
      )}

      {hasMultiple ? (
        <>
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white/90 backdrop-blur">
            <Images size={11} /> {index + 1}/{images.length}
          </span>

          <button
            type="button"
            aria-label="Previous photo"
            onClick={(e) => onArrow(e, -1)}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white opacity-0 backdrop-blur transition hover:bg-black/80 group-hover:opacity-100"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            aria-label="Next photo"
            onClick={(e) => onArrow(e, 1)}
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
    </div>
  );
}
