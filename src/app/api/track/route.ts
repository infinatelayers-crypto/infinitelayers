import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";

type TrackRow = {
  order_no: string;
  status: string;
  payment_status: string;
  items: unknown;
  subtotal_paise: number;
  delivery_paise: number;
  discount_paise: number;
  total_paise: number;
  created_at: string;
  address_hint: string;
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request." },
      { status: 400 },
    );
  }

  const orderNo = typeof body.orderNo === "string" ? body.orderNo.trim() : "";
  const phone =
    typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";

  // Need at least one identifier.
  if (!orderNo && !phone) {
    return NextResponse.json(
      { ok: false, message: "Enter your order number or phone number." },
      { status: 400 },
    );
  }
  if (orderNo.length > 40 || (phone && phone.length !== 10)) {
    return NextResponse.json(
      { ok: false, message: "Enter a valid order number or 10-digit phone." },
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

  const { data, error } = await supabase.rpc("track_orders", {
    p_order_no: orderNo,
    p_phone: phone,
  });

  if (error) {
    return NextResponse.json({
      ok: false,
      message:
        error.code === "22023"
          ? "No orders found for that number or phone."
          : "Could not look up your orders.",
    });
  }

  const rows = (data as TrackRow[] | null) ?? [];
  if (rows.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "No orders found for that number or phone.",
    });
  }

  return NextResponse.json({
    ok: true,
    orders: rows.map((row) => ({
      orderNo: row.order_no,
      status: row.status,
      paymentStatus: row.payment_status,
      items: row.items,
      subtotalPaise: row.subtotal_paise,
      deliveryPaise: row.delivery_paise,
      discountPaise: row.discount_paise,
      totalPaise: row.total_paise,
      createdAt: row.created_at,
      addressHint: row.address_hint,
    })),
  });
}
