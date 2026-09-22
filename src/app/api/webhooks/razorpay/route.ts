import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  getRazorpayWebhookSecret,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay";

type RazorpayPaymentEntity = {
  id?: string;
  order_id?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
  };
};

// Razorpay needs the exact raw body to verify the signature.
export async function POST(request: Request) {
  const webhookSecret = getRazorpayWebhookSecret();
  if (!webhookSecret) {
    // Webhooks not configured — acknowledge so Razorpay doesn't retry forever.
    return NextResponse.json({ ok: true, ignored: "not-configured" });
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const rawBody = await request.text();

  if (!signature || !verifyWebhookSignature(webhookSecret, rawBody, signature)) {
    return NextResponse.json(
      { ok: false, message: "Invalid signature" },
      { status: 400 },
    );
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    // Signature was valid but body isn't JSON — acknowledge, nothing to do.
    return NextResponse.json({ ok: true, ignored: "unparseable" });
  }

  const entity = payload.payload?.payment?.entity;
  const razorpayOrderId = entity?.order_id;
  const razorpayPaymentId = entity?.id;

  if (!razorpayOrderId) {
    return NextResponse.json({ ok: true, ignored: "no-order-id" });
  }

  const supabase = createAdminSupabase();
  if (!supabase) {
    // Can't reconcile without the service role. Ask Razorpay to retry later.
    console.error("Razorpay webhook: service role not configured.");
    return NextResponse.json(
      { ok: false, message: "Store not configured" },
      { status: 503 },
    );
  }

  try {
    if (payload.event === "payment.captured" || payload.event === "order.paid") {
      const { error } = await supabase.rpc("mark_order_paid_by_rp", {
        p_razorpay_order_id: razorpayOrderId,
        p_razorpay_payment_id: razorpayPaymentId ?? null,
      });
      if (error) throw new Error(error.message);
    } else if (payload.event === "payment.failed") {
      const { error } = await supabase.rpc("mark_order_failed_by_rp", {
        p_razorpay_order_id: razorpayOrderId,
      });
      if (error) throw new Error(error.message);
    }
    // Other events are acknowledged without action.
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);
    // 500 so Razorpay retries; our DB ops are idempotent, so retries are safe.
    return NextResponse.json(
      { ok: false, message: "Processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
