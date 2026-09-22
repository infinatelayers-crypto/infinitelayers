import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";

type PreviewRow = {
  ok: boolean;
  discount_paise: number;
  message: string;
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

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const subtotalPaise = body.subtotalPaise;

  if (!code || code.length > 24) {
    return NextResponse.json(
      { ok: false, message: "Enter a coupon code." },
      { status: 400 },
    );
  }
  if (
    !Number.isInteger(subtotalPaise) ||
    (subtotalPaise as number) < 1 ||
    (subtotalPaise as number) > 100000000
  ) {
    return NextResponse.json(
      { ok: false, message: "Invalid cart total." },
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

  const { data, error } = await supabase.rpc("preview_coupon", {
    p_code: code,
    p_subtotal_paise: subtotalPaise as number,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Could not check that code." },
      { status: 500 },
    );
  }

  const row = (data as PreviewRow[] | null)?.[0];
  if (!row || !row.ok) {
    return NextResponse.json({
      ok: false,
      message: row?.message ?? "Invalid coupon code.",
    });
  }

  return NextResponse.json({
    ok: true,
    discountPaise: row.discount_paise,
    message: row.message,
  });
}
