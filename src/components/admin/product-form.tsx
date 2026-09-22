/* eslint-disable @next/next/no-img-element */
"use client";

import {
  AlertCircle,
  ImagePlus,
  LoaderCircle,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  deleteProductAction,
  saveProductAction,
  type ProductMutationInput,
} from "@/app/admin/actions";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Product } from "@/lib/types";

const MAX_IMAGES = 6;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const FILE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function makeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function getProductImagePath(value: string): string | null {
  try {
    const pathname = new URL(value).pathname;
    const marker = "/storage/v1/object/public/product-images/";
    const markerIndex = pathname.indexOf(marker);
    return markerIndex >= 0
      ? decodeURIComponent(pathname.slice(markerIndex + marker.length))
      : null;
  } catch {
    return null;
  }
}

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [keptImageUrls, setKeptImageUrls] = useState(
    product?.imageUrls ?? [],
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const newImagePreviews = useMemo(
    () => newFiles.map((file) => URL.createObjectURL(file)),
    [newFiles],
  );

  useEffect(
    () => () => {
      newImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    },
    [newImagePreviews],
  );

  const totalImages = keptImageUrls.length + newFiles.length;

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(makeSlug(value));
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedFiles.length) return;

    const invalidType = selectedFiles.find(
      (file) => !ALLOWED_IMAGE_TYPES.has(file.type),
    );
    if (invalidType) {
      setError("Use JPG, PNG, WebP, or GIF image files only.");
      return;
    }

    const oversized = selectedFiles.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than 8 MB.`);
      return;
    }

    const availableSlots = MAX_IMAGES - totalImages;
    if (selectedFiles.length > availableSlots) {
      setError(
        `Only ${availableSlots} more photo${availableSlots === 1 ? "" : "s"} can be added.`,
      );
      return;
    }

    setError(undefined);
    setNewFiles((current) => [...current, ...selectedFiles]);
  }

  async function removeUploadedPaths(paths: string[]) {
    if (!paths.length) return;
    const supabase = createBrowserClient();
    if (supabase) await supabase.storage.from("product-images").remove(paths);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const supabase = createBrowserClient();

    setError(undefined);
    if (!supabase) {
      setError("Supabase is not configured in this browser.");
      return;
    }

    setIsSaving(true);
    const productId = product?.id ?? crypto.randomUUID();
    const uploadedPaths: string[] = [];
    const uploadedUrls: string[] = [];

    try {
      for (const [index, file] of newFiles.entries()) {
        setProgress(`Uploading photo ${index + 1} of ${newFiles.length}…`);
        const extension = FILE_EXTENSIONS[file.type];
        const path = `${productId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(path, file, {
            cacheControl: "31536000",
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw new Error(uploadError.message);

        uploadedPaths.push(path);
        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(path);
        uploadedUrls.push(data.publicUrl);
      }

      setProgress("Saving product details…");
      const rupeeValue = Number(formData.get("priceRupees"));
      const input: ProductMutationInput = {
        id: productId,
        mode: product ? "edit" : "create",
        name,
        slug,
        category: String(formData.get("category") ?? ""),
        description: String(formData.get("description") ?? ""),
        details: String(formData.get("details") ?? ""),
        pricePaise: Number.isFinite(rupeeValue)
          ? Math.round(rupeeValue * 100)
          : Number.NaN,
        imageUrls: [...keptImageUrls, ...uploadedUrls],
        featured: formData.get("featured") === "on",
        inStock: formData.get("inStock") === "on",
      };

      const result = await saveProductAction(input);
      if (!result.ok) {
        await removeUploadedPaths(uploadedPaths);
        setError(result.error ?? "Could not save the product.");
        return;
      }

      const removedPaths = (product?.imageUrls ?? []).flatMap((url) => {
        if (keptImageUrls.includes(url)) return [];
        const path = getProductImagePath(url);
        return path ? [path] : [];
      });
      await removeUploadedPaths(removedPaths);

      router.push("/admin/products");
      router.refresh();
    } catch (uploadError) {
      await removeUploadedPaths(uploadedPaths);
      setError(
        uploadError instanceof Error
          ? `Could not upload photos: ${uploadError.message}`
          : "Could not upload photos.",
      );
    } finally {
      setProgress(undefined);
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!product) return;
    const confirmed = window.confirm(
      `Delete “${product.name}”? This also removes its uploaded photos and cannot be undone.`,
    );
    if (!confirmed) return;

    setError(undefined);
    setIsDeleting(true);
    const result = await deleteProductAction(product.id);
    if (!result.ok) {
      setError(result.error ?? "Could not delete the product.");
      setIsDeleting(false);
      return;
    }

    router.push("/admin/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="mb-6">
          <p className="font-display text-lg font-semibold text-fg">
            Product information
          </p>
          <p className="mt-1 text-xs text-fg-subtle">
            These details appear publicly on the shop and product page.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Product name
            </span>
            <input
              required
              minLength={3}
              maxLength={120}
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50"
              placeholder="Painted sci-fi cosplay helmet"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Store URL slug
            </span>
            <div className="flex rounded-xl border border-border bg-surface-2 focus-within:border-accent/50">
              <span className="border-r border-border px-3 py-3 text-sm text-fg-subtle">
                /product/
              </span>
              <input
                required
                maxLength={100}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(makeSlug(event.target.value));
                }}
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-fg outline-none"
                placeholder="painted-cosplay-helmet"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Category
            </span>
            <input
              required
              minLength={2}
              maxLength={60}
              name="category"
              list="product-categories"
              defaultValue={product?.category ?? "Cosplay"}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition focus:border-accent/50"
            />
            <datalist id="product-categories">
              <option value="Cosplay" />
              <option value="Collectibles" />
              <option value="Custom" />
              <option value="Home decor" />
            </datalist>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Short description
            </span>
            <textarea
              required
              minLength={10}
              maxLength={2000}
              name="description"
              rows={4}
              defaultValue={product?.description}
              className="w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3 leading-6 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50"
              placeholder="Explain what the product is, its finish, and why someone would want it."
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Full product details
            </span>
            <textarea
              maxLength={5000}
              name="details"
              rows={6}
              defaultValue={product?.details}
              className="w-full resize-y rounded-xl border border-border bg-surface-2 px-4 py-3 leading-6 text-fg outline-none transition placeholder:text-fg-subtle focus:border-accent/50"
              placeholder={"Material: PLA+\nFinish: Hand-painted\nSizing: Adult wearable\nLead time: 7–10 days"}
            />
            <span className="mt-2 block text-xs text-fg-subtle">
              Put one specification per line for easy reading.
            </span>
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-display text-lg font-semibold text-fg">
              Product photos
            </p>
            <p className="mt-1 text-xs leading-5 text-fg-subtle">
              Upload JPG, PNG, WebP, or GIF files. Maximum 8 MB each. The first
              photo becomes the cover.
            </p>
          </div>
          <span className="w-fit rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-fg-muted">
            {totalImages}/{MAX_IMAGES}
          </span>
        </div>

        {totalImages ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {keptImageUrls.map((url, index) => (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2"
              >
                <img
                  src={url}
                  alt={`${name || "Product"} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute bottom-2 left-2 rounded-md bg-fg/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-accent">
                    Cover
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() =>
                    setKeptImageUrls((images) =>
                      images.filter((image) => image !== url),
                    )
                  }
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-fg/80 text-fg-muted opacity-100 transition hover:bg-red-500 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {newImagePreviews.map((url, index) => {
              const imageNumber = keptImageUrls.length + index + 1;
              return (
                <div
                  key={url}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-accent/30 bg-surface-2"
                >
                  <img
                    src={url}
                    alt={`${name || "Product"} new photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  {imageNumber === 1 ? (
                    <span className="absolute bottom-2 left-2 rounded-md bg-fg/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-accent">
                      Cover
                    </span>
                  ) : (
                    <span className="absolute bottom-2 left-2 rounded-md bg-accent/90 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-accent-fg">
                      New
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove new photo ${index + 1}`}
                    onClick={() =>
                      setNewFiles((files) =>
                        files.filter((_, fileIndex) => fileIndex !== index),
                      )
                    }
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-fg/80 text-fg-muted opacity-100 transition hover:bg-red-500 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 px-5 text-center">
            <ImagePlus size={26} className="text-fg-subtle" />
            <p className="mt-3 text-sm font-semibold text-fg-muted">No photos yet</p>
            <p className="mt-1 text-xs text-fg-subtle">
              Add a clear cover photo and up to five alternate views.
            </p>
          </div>
        )}

        <label
          className={`mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition ${
            totalImages >= MAX_IMAGES
              ? "pointer-events-none opacity-40"
              : "text-fg hover:border-accent/40 hover:bg-accent-soft"
          }`}
        >
          <UploadCloud size={17} /> Add photos
          <input
            multiple
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={totalImages >= MAX_IMAGES || isSaving}
            onChange={handleFiles}
          />
        </label>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 sm:p-7">
        <p className="font-display text-lg font-semibold text-fg">
          Price and visibility
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-fg-muted">
              Price (₹)
            </span>
            <input
              required
              min="0.01"
              max="1000000"
              step="0.01"
              name="priceRupees"
              type="number"
              defaultValue={product ? product.pricePaise / 100 : undefined}
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-fg outline-none transition focus:border-accent/50"
              placeholder="2499"
            />
          </label>

          <div className="space-y-3">
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-fg">
                  Available to order
                </span>
                <span className="mt-0.5 block text-xs text-fg-subtle">
                  Customers can add this item to cart
                </span>
              </span>
              <input
                name="inStock"
                type="checkbox"
                defaultChecked={product?.inStock ?? true}
                className="h-4 w-4 accent-accent"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-fg">
                  Featured product
                </span>
                <span className="mt-0.5 block text-xs text-fg-subtle">
                  Highlight this item on the homepage
                </span>
              </span>
              <input
                name="featured"
                type="checkbox"
                defaultChecked={product?.featured ?? false}
                className="h-4 w-4 accent-accent"
              />
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {product ? (
            <button
              type="button"
              disabled={isSaving || isDeleting}
              onClick={handleDelete}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
            >
              {isDeleting ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
              Delete product
            </button>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {progress ? (
            <p className="text-xs font-medium text-accent">{progress}</p>
          ) : null}
          <button
            disabled={isSaving || isDeleting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-accent-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}
            {product ? "Save changes" : "Publish product"}
          </button>
        </div>
      </div>
    </form>
  );
}
