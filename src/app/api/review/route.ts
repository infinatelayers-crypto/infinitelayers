import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";
import { getStoreSettings } from "@/lib/settings";

function isFormspreeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "formspree.io";
  } catch {
    return false;
  }
}

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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const rating = Number(body.rating);

  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { ok: false, message: "Enter your name." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { ok: false, message: "Choose a rating from 1 to 5." },
      { status: 400 },
    );
  }
  if (message.length < 4 || message.length > 800) {
    return NextResponse.json(
      { ok: false, message: "Write a short review (4–800 characters)." },
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

  const { error } = await supabase.rpc("submit_review", {
    p_name: name,
    p_rating: rating,
    p_message: message,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Could not submit your review." },
      { status: 500 },
    );
  }

  // Optional: also email via Formspree feedback endpoint if configured.
  const settings = await getStoreSettings();
  if (settings.feedbackFormUrl && isFormspreeUrl(settings.feedbackFormUrl)) {
    try {
      await fetch(settings.feedbackFormUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Review",
          name,
          rating,
          message,
        }),
      });
    } catch {
      // Non-fatal — the review is already saved.
    }
  }

  return NextResponse.json({ ok: true });
}
