"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export type ActionResult = {
  ok: boolean;
  error?: string;
  slug?: string;
};

export type ProductMutationInput = {
  id: string;
  mode: "create" | "edit";
  name: string;
  slug: string;
  category: string;
  description: string;
  details: string;
  pricePaise: number;
  imageUrls: string[];
  featured: boolean;
  inStock: boolean;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isSafeImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && value.length <= 1200;
  } catch {
    return false;
  }
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

function revalidateStorefront(slug?: string) {
  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/product/${slug}`);
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const supabase = await createServerSupabase();

  if (!supabase) redirect("/admin/login?error=configuration");
  if (!email || password.length < 6) {
    redirect("/admin/login?error=credentials");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    console.error("Admin sign-in failed:", {
      email,
      passwordLength: password.length,
      supabaseError: error?.message,
      status: error?.status,
    });
    redirect("/admin/login?error=credentials");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=unauthorized");
  }

  revalidatePath("/admin", "layout");
  redirect("/admin");
}

export async function logoutAction() {
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut();
  revalidatePath("/admin", "layout");
  redirect("/admin/login");
}

export async function saveProductAction(
  input: ProductMutationInput,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const slug = typeof input.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const category =
    typeof input.category === "string" ? input.category.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const details =
    typeof input.details === "string" ? input.details.trim() : "";

  if (!UUID_PATTERN.test(input.id ?? "")) {
    return { ok: false, error: "Invalid product ID." };
  }
  if (input.mode !== "create" && input.mode !== "edit") {
    return { ok: false, error: "Invalid product operation." };
  }
  if (name.length < 3 || name.length > 120) {
    return { ok: false, error: "Product name must be 3–120 characters." };
  }
  if (!SLUG_PATTERN.test(slug) || slug.length > 100) {
    return { ok: false, error: "Use a short URL slug with letters, numbers, and hyphens." };
  }
  if (category.length < 2 || category.length > 60) {
    return { ok: false, error: "Category must be 2–60 characters." };
  }
  if (description.length < 10 || description.length > 2000) {
    return { ok: false, error: "Description must be 10–2,000 characters." };
  }
  if (details.length > 5000) {
    return { ok: false, error: "Product details cannot exceed 5,000 characters." };
  }
  if (
    !Number.isInteger(input.pricePaise) ||
    input.pricePaise < 1 ||
    input.pricePaise > 100000000
  ) {
    return { ok: false, error: "Enter a valid product price." };
  }
  if (
    !Array.isArray(input.imageUrls) ||
    input.imageUrls.length > 6 ||
    input.imageUrls.some(
      (url) => typeof url !== "string" || !isSafeImageUrl(url),
    )
  ) {
    return { ok: false, error: "Products can contain up to six valid image URLs." };
  }
  if (typeof input.featured !== "boolean" || typeof input.inStock !== "boolean") {
    return { ok: false, error: "Invalid product availability." };
  }

  const imageUrls = Array.from(new Set(input.imageUrls));
  const productRecord = {
    slug,
    name,
    category,
    description,
    details,
    price_paise: input.pricePaise,
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls,
    featured: input.featured,
    in_stock: input.inStock,
  };

  let previousSlug: string | undefined;
  if (input.mode === "edit") {
    const { data: previous } = await supabase
      .from("products")
      .select("slug")
      .eq("id", input.id)
      .maybeSingle();
    previousSlug = previous?.slug;
  }

  const query =
    input.mode === "create"
      ? supabase.from("products").insert({ id: input.id, ...productRecord })
      : supabase.from("products").update(productRecord).eq("id", input.id);

  const { data, error } = await query.select("id").maybeSingle();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That product URL is already in use. Choose another slug."
          : "Could not save the product. Check the database migration and try again.",
    };
  }
  if (!data) return { ok: false, error: "Product was not found or access was denied." };

  if (previousSlug && previousSlug !== slug) revalidateStorefront(previousSlug);
  revalidateStorefront(slug);
  return { ok: true, slug };
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid product ID." };

  const { data: product, error: readError } = await supabase
    .from("products")
    .select("slug, image_urls, image_url")
    .eq("id", id)
    .maybeSingle();

  if (readError || !product) return { ok: false, error: "Product was not found." };

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the product." };

  const imageUrls = Array.from(
    new Set([
      ...((product.image_urls as string[] | null) ?? []),
      ...(product.image_url ? [product.image_url] : []),
    ]),
  );
  const imagePaths = imageUrls.flatMap((url) => {
    const path = getProductImagePath(url);
    return path ? [path] : [];
  });

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove(imagePaths);
    if (storageError) {
      console.error("Product deleted, but image cleanup failed:", storageError.message);
    }
  }

  revalidateStorefront(product.slug);
  return { ok: true };
}

export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(orderId)) return { ok: false, error: "Invalid order ID." };
  if (!ORDER_STATUSES.some((allowedStatus) => allowedStatus === status)) {
    return { ok: false, error: "Invalid order status." };
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Could not update this booking." };

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Store settings + coupons
// ---------------------------------------------------------------------------

export type SettingsInput = {
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutText: string;
  instagramUrl: string;
  whatsappNumber: string;
  deliveryFeePaise: number;
  freeDeliveryOverPaise: number;
  supportEmail: string;
  supportFormUrl: string;
  feedbackFormUrl: string;
  showWhatsapp: boolean;
  showEmail: boolean;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function saveSettingsAction(
  input: SettingsInput,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const heroBadge = input.heroBadge?.trim() ?? "";
  const heroTitle = input.heroTitle?.trim() ?? "";
  const heroSubtitle = input.heroSubtitle?.trim() ?? "";
  const aboutText = input.aboutText?.trim() ?? "";
  const instagramUrl = input.instagramUrl?.trim() ?? "";
  const whatsappNumber = input.whatsappNumber?.replace(/\D/g, "") ?? "";
  const supportEmail = input.supportEmail?.trim() ?? "";
  const supportFormUrl = input.supportFormUrl?.trim() ?? "";
  const feedbackFormUrl = input.feedbackFormUrl?.trim() ?? "";

  if (heroTitle.length < 3 || heroTitle.length > 160) {
    return { ok: false, error: "Hero title must be 3–160 characters." };
  }
  if (heroSubtitle.length > 400 || heroBadge.length > 120 || aboutText.length > 600) {
    return { ok: false, error: "One of the text fields is too long." };
  }
  if (instagramUrl && !isHttpUrl(instagramUrl)) {
    return { ok: false, error: "Enter a valid Instagram URL." };
  }
  if (whatsappNumber && (whatsappNumber.length < 10 || whatsappNumber.length > 15)) {
    return { ok: false, error: "Enter a valid WhatsApp number." };
  }
  if (supportEmail && (supportEmail.length > 160 || !supportEmail.includes("@"))) {
    return { ok: false, error: "Enter a valid support email." };
  }
  if (supportFormUrl && !isHttpUrl(supportFormUrl)) {
    return { ok: false, error: "Enter a valid support form URL." };
  }
  if (feedbackFormUrl && !isHttpUrl(feedbackFormUrl)) {
    return { ok: false, error: "Enter a valid feedback form URL." };
  }
  if (
    !Number.isInteger(input.deliveryFeePaise) ||
    input.deliveryFeePaise < 0 ||
    input.deliveryFeePaise > 1000000 ||
    !Number.isInteger(input.freeDeliveryOverPaise) ||
    input.freeDeliveryOverPaise < 0 ||
    input.freeDeliveryOverPaise > 100000000
  ) {
    return { ok: false, error: "Enter valid delivery amounts." };
  }

  const { error } = await supabase
    .from("store_settings")
    .update({
      hero_badge: heroBadge,
      hero_title: heroTitle,
      hero_subtitle: heroSubtitle,
      about_text: aboutText,
      instagram_url: instagramUrl,
      whatsapp_number: whatsappNumber,
      delivery_fee_paise: input.deliveryFeePaise,
      free_delivery_over_paise: input.freeDeliveryOverPaise,
      support_email: supportEmail,
      support_form_url: supportFormUrl,
      feedback_form_url: feedbackFormUrl,
      show_whatsapp: Boolean(input.showWhatsapp),
      show_email: Boolean(input.showEmail),
    })
    .eq("id", true);

  if (error) return { ok: false, error: "Could not save settings." };

  revalidatePath("/");
  revalidatePath("/admin/settings", "layout");
  return { ok: true };
}

export type CouponInput = {
  code: string;
  discountType: "flat" | "percent";
  discountValue: number;
  minOrderPaise: number;
  maxDiscountPaise: number | null;
  active: boolean;
  expiresAt: string | null;
};

const CODE_PATTERN = /^[A-Z0-9]{3,24}$/;

export async function saveCouponAction(
  id: string | null,
  input: CouponInput,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };

  const code = input.code?.trim().toUpperCase() ?? "";
  if (!CODE_PATTERN.test(code)) {
    return { ok: false, error: "Code must be 3–24 letters/numbers." };
  }
  if (input.discountType !== "flat" && input.discountType !== "percent") {
    return { ok: false, error: "Invalid discount type." };
  }
  if (!Number.isInteger(input.discountValue) || input.discountValue < 1) {
    return { ok: false, error: "Enter a valid discount value." };
  }
  if (input.discountType === "percent" && input.discountValue > 100) {
    return { ok: false, error: "Percent discount cannot exceed 100." };
  }
  if (
    !Number.isInteger(input.minOrderPaise) ||
    input.minOrderPaise < 0 ||
    input.minOrderPaise > 100000000
  ) {
    return { ok: false, error: "Enter a valid minimum order amount." };
  }
  if (
    input.maxDiscountPaise !== null &&
    (!Number.isInteger(input.maxDiscountPaise) || input.maxDiscountPaise < 1)
  ) {
    return { ok: false, error: "Enter a valid maximum discount." };
  }

  const record = {
    code,
    discount_type: input.discountType,
    discount_value: input.discountValue,
    min_order_paise: input.minOrderPaise,
    max_discount_paise: input.maxDiscountPaise,
    active: Boolean(input.active),
    expires_at: input.expiresAt,
  };

  const query =
    id === null
      ? supabase.from("coupons").insert(record)
      : supabase.from("coupons").update(record).eq("id", id);

  const { error } = await query;
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That coupon code already exists."
          : "Could not save the coupon.",
    };
  }

  revalidatePath("/admin/coupons");
  return { ok: true };
}

export async function deleteCouponAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid coupon ID." };

  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the coupon." };

  revalidatePath("/admin/coupons");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reviews + support (admin moderation)
// ---------------------------------------------------------------------------

export async function updateReviewAction(
  id: string,
  changes: { approved?: boolean; featured?: boolean },
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid review ID." };

  const patch: Record<string, boolean> = {};
  if (typeof changes.approved === "boolean") patch.approved = changes.approved;
  if (typeof changes.featured === "boolean") patch.featured = changes.featured;
  // Featuring implies approval so it can appear publicly.
  if (patch.featured === true) patch.approved = true;

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  const { error } = await supabase.from("reviews").update(patch).eq("id", id);
  if (error) return { ok: false, error: "Could not update the review." };

  revalidatePath("/");
  revalidatePath("/admin/reviews");
  return { ok: true };
}

export async function deleteReviewAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid review ID." };

  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the review." };

  revalidatePath("/");
  revalidatePath("/admin/reviews");
  return { ok: true };
}

export async function updateSupportAction(
  id: string,
  handled: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid message ID." };

  const { error } = await supabase
    .from("support_messages")
    .update({ handled })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not update the message." };

  revalidatePath("/admin/support");
  return { ok: true };
}

export async function deleteSupportAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Supabase is not configured." };
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Invalid message ID." };

  const { error } = await supabase
    .from("support_messages")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete the message." };

  revalidatePath("/admin/support");
  return { ok: true };
}
