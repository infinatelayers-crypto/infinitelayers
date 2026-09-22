import { NextResponse } from "next/server";
import { createPublicSupabase } from "@/lib/supabase/public";
import { getStoreSettings } from "@/lib/settings";

function isFormspreeUrl(value: string): boolean {
  try {
    return new URL(value).hostname === "formspree.io";
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
  const contact = typeof body.contact === "string" ? body.contact.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { ok: false, message: "Enter your name." },
      { status: 400 },
    );
  }
  if (contact.length < 5 || contact.length > 120) {
    return NextResponse.json(
      { ok: false, message: "Enter a phone or email so we can reply." },
      { status: 400 },
    );
  }
  if (message.length < 4 || message.length > 1500) {
    return NextResponse.json(
      { ok: false, message: "Enter your message." },
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

  const { error } = await supabase.rpc("submit_support_message", {
    p_name: name,
    p_contact: contact,
    p_message: message,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: "Could not send your message." },
      { status: 500 },
    );
  }

  // Also email via Formspree support endpoint if configured.
  const settings = await getStoreSettings();
  if (settings.supportFormUrl && isFormspreeUrl(settings.supportFormUrl)) {
    try {
      await fetch(settings.supportFormUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ type: "Support", name, contact, message }),
      });
    } catch {
      // Non-fatal — the message is already saved.
    }
  }

  return NextResponse.json({ ok: true });
}
