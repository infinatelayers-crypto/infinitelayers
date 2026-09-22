import "server-only";

import { createHmac } from "crypto";

export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
};

/** Returns credentials only when both are present, else null (dormant mode). */
export function getRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function isRazorpayEnabled(): boolean {
  return getRazorpayConfig() !== null;
}

export function getRazorpayWebhookSecret(): string | null {
  return process.env.RAZORPAY_WEBHOOK_SECRET?.trim() || null;
}

type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  status: string;
};

/** Creates a Razorpay order via REST (no SDK dependency needed). */
export async function createRazorpayOrder(
  config: RazorpayConfig,
  amountPaise: number,
  receipt: string,
): Promise<RazorpayOrder> {
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString(
    "base64",
  );

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency: "INR",
      receipt: receipt.slice(0, 40),
      payment_capture: 1,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Razorpay order creation failed: ${response.status} ${detail}`);
  }

  return (await response.json()) as RazorpayOrder;
}

/**
 * Verifies the Razorpay checkout signature.
 * signature === HMAC_SHA256(order_id + "|" + payment_id, key_secret).
 * Uses a length-checked constant-time-ish comparison.
 */
export function verifyRazorpaySignature(
  config: RazorpayConfig,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", config.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return timingSafeEqualHex(expected, signature);
}

/**
 * Verifies a Razorpay webhook signature. The signature is
 * HMAC_SHA256(rawBody, webhookSecret) sent in the `x-razorpay-signature`
 * header. Must be computed over the exact raw request body.
 */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}
