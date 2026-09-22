import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";
import {
  getRazorpayConfig,
  verifyRazorpaySignature,
} from "@/lib/payments/razorpay";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MarkPaidRow = {
  order_id: string;
  order_no: string;
};

export async function POST(request: Request) {
  const config = getRazorpayConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, message: "Payments are not enabled." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid verification request." },
      { status: 400 },
    );
  }

  const checkoutToken =
    typeof body.checkoutToken === "string" ? body.checkoutToken : "";
  const razorpayOrderId =
    typeof body.razorpayOrderId === "string" ? body.razorpayOrderId : "";
  const razorpayPaymentId =
    typeof body.razorpayPaymentId === "string" ? body.razorpayPaymentId : "";
  const razorpaySignature =
    typeof body.razorpaySignature === "string" ? body.razorpaySignature : "";

  if (
    !UUID_PATTERN.test(checkoutToken) ||
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return NextResponse.json(
      { ok: false, message: "Missing payment details." },
      { status: 400 },
    );
  }

  const valid = verifyRazorpaySignature(
    config,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );

  if (!valid) {
    return NextResponse.json(
      { ok: false, message: "Payment signature verification failed." },
      { status: 400 },
    );
  }

  const supabase = createPublicSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, message: "Store is not configured." },
      { status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("mark_order_paid", {
    p_checkout_token: checkoutToken,
    p_razorpay_order_id: razorpayOrderId,
    p_razorpay_payment_id: razorpayPaymentId,
  });

  if (error) {
    console.error("mark_order_paid failed:", error.code);
    return NextResponse.json(
      { ok: false, message: "Could not confirm payment on the order." },
      { status: 500 },
    );
  }

  const order = (data as MarkPaidRow[] | null)?.[0];
  return NextResponse.json({
    ok: true,
    orderId: order?.order_id,
    orderNo: order?.order_no,
  });
}
