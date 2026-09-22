import { createPublicSupabase } from "./supabase/public";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "./types";

type DbSettings = {
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  about_text: string;
  instagram_url: string;
  whatsapp_number: string;
  delivery_fee_paise: number;
  free_delivery_over_paise: number;
  support_email?: string | null;
  support_form_url?: string | null;
  feedback_form_url?: string | null;
  show_whatsapp?: boolean | null;
  show_email?: boolean | null;
};

export function mapSettings(row: DbSettings): StoreSettings {
  return {
    heroBadge: row.hero_badge,
    heroTitle: row.hero_title,
    heroSubtitle: row.hero_subtitle,
    aboutText: row.about_text,
    instagramUrl: row.instagram_url,
    whatsappNumber: row.whatsapp_number,
    deliveryFeePaise: row.delivery_fee_paise,
    freeDeliveryOverPaise: row.free_delivery_over_paise,
    supportEmail: row.support_email ?? "",
    supportFormUrl: row.support_form_url ?? "",
    feedbackFormUrl: row.feedback_form_url ?? "",
    showWhatsapp: row.show_whatsapp ?? false,
    showEmail: row.show_email ?? false,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = createPublicSupabase();
  if (!supabase) return DEFAULT_STORE_SETTINGS;

  const { data, error } = await supabase
    .from("store_settings")
    .select("*")
    .maybeSingle();

  if (error || !data) return DEFAULT_STORE_SETTINGS;
  return mapSettings(data as DbSettings);
}
