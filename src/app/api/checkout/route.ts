import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";
import {
  createRazorpayOrder,
  getRazorpayConfig,
} from "@/lib/payments/razorpay";

type RequestedItem = {
  productId: string;
  quantity: number;
};

type OrderRpcRow = {
  order_id: string;
  order_no: string;
  subtotal_paise: number;
  delivery_paise: number;
  discount_paise: number;
  total_paise: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseItems(value: unknown): RequestedItem[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return null;
  }

  const items: RequestedItem[] = [];
  const seen = new Set<string>();

  for (const valueItem of value) {
    if (!valueItem || typeof valueItem !== "object") return null;

    const item = valueItem as Record<string, unknown>;
    if (
      typeof item.productId !== "string" ||
      !UUID_PATTERN.test(item.productId) ||
      !Number.isInteger(item.quantity) ||
      (item.quantity as number) < 1 ||
      (item.quantity as number) > 10 ||
      seen.has(item.productId)
    ) {
      return null;
    }

    seen.add(item.productId);
    items.push({
      productId: item.productId,
      quantity: item.quantity as number,
    });
  }

  return items;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid checkout request." },
      { status: 400 },
    );
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const checkoutToken =
    typeof body.checkoutToken === "string" ? body.checkoutToken : "";
  const expectedTotalPaise = body.expectedTotalPaise;
  const couponCode =
    typeof body.couponCode === "string" ? body.couponCode.trim() : "";
  const items = parseItems(body.items);

  if (!/^\d{10}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid 10-digit phone number." },
      { status: 400 },
    );
  }

  if (address.length < 10 || address.length > 600) {
    return NextResponse.json(
      { ok: false, message: "Enter a complete delivery address." },
      { status: 400 },
    );
  }

  if (!UUID_PATTERN.test(checkoutToken)) {
    return NextResponse.json(
      { ok: false, message: "Invalid checkout attempt." },
      { status: 400 },
    );
  }

  if (
    !Number.isInteger(expectedTotalPaise) ||
    (expectedTotalPaise as number) < 1 ||
    (expectedTotalPaise as number) > 100000000
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid checkout total." },
      { status: 400 },
    );
  }

  if (!items) {
    return NextResponse.json(
      { ok: false, message: "Your cart contains an invalid item." },
      { status: 400 },
    );
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Ordering is not configured yet." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("create_store_order_v3", {
    p_phone: phone,
    p_address: address,
    p_items: items,
    p_expected_total: expectedTotalPaise as number,
    p_checkout_token: checkoutToken,
    p_coupon_code: couponCode || null,
  });

  if (error) {
    // Full detail in the terminal so setup issues are diagnosable.
    console.error("Order creation failed:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    const isValidationError = error.code === "22023";
    const isRateLimited = error.code === "P0001";
    return NextResponse.json(
      {
        ok: false,
        message: isRateLimited
          ? "Too many booking attempts. Wait a few minutes and try again."
          : isValidationError
            ? "A product or price changed. Refresh your cart and confirm the updated total."
            : "Could not save your order. Please try again.",
      },
      { status: isRateLimited ? 429 : isValidationError ? 400 : 500 },
    );
  }

  const order = (data as OrderRpcRow[] | null)?.[0];
  if (!order) {
    return NextResponse.json(
      { ok: false, message: "Could not confirm your order." },
      { status: 500 },
    );
  }

  // Razorpay: create a payment order when keys exist. Dormant otherwise.
  const razorpayConfig = getRazorpayConfig();
  if (razorpayConfig) {
    try {
      const rpOrder = await createRazorpayOrder(
        razorpayConfig,
        order.total_paise,
        order.order_no,
      );

      // Record the Razorpay order id so the webhook backstop can reconcile
      // payment even if the browser never calls /verify.
      await supabase.rpc("attach_razorpay_order", {
        p_checkout_token: checkoutToken,
        p_razorpay_order_id: rpOrder.id,
      });

      return NextResponse.json({
        ok: true,
        payment: "razorpay",
        orderId: order.order_id,
        orderNo: order.order_no,
        totalPaise: order.total_paise,
        razorpayKeyId: razorpayConfig.keyId,
        razorpayOrderId: rpOrder.id,
        checkoutToken,
      });
    } catch (paymentError) {
      // Order is already saved; let the customer complete payment manually.
      console.error("Razorpay order creation failed:", paymentError);
      return NextResponse.json({
        ok: true,
        payment: "manual",
        orderId: order.order_id,
        orderNo: order.order_no,
        totalPaise: order.total_paise,
        message:
          "Booking saved. We could not start online payment — we will contact you to confirm.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    payment: "manual",
    orderId: order.order_id,
    orderNo: order.order_no,
    totalPaise: order.total_paise,
    message: "Booking saved. We will contact you to confirm payment.",
  });
}
