import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Service-role client. Bypasses RLS — use ONLY in trusted server contexts
 * (e.g. verified webhooks), never in code reachable by the browser.
 * Returns null when the service key is not configured.
 */
export function createAdminSupabase(): SupabaseClient | null {
  const config = getSupabasePublicConfig();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceKey) return null;

  return createClient(config.url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
