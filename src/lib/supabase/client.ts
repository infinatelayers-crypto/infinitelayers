import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

export function createBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  return createSupabaseBrowserClient(config.url, config.key);
}
