import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type AdminIdentity = {
  id: string;
  email: string;
};

export const getAdminIdentity = cache(
  async (): Promise<AdminIdentity | null> => {
    const supabase = await createServerSupabase();
    if (!supabase) return null;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    const { data: membership, error: membershipError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) return null;

    return {
      id: user.id,
      email: user.email ?? "Store admin",
    };
  },
);

export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) redirect("/admin/login");
  return admin;
}
