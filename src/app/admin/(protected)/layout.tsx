import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { logoutAction } from "../actions";
import { requireAdmin } from "@/lib/admin/auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <AdminShell email={admin.email} logoutAction={logoutAction}>
      {children}
    </AdminShell>
  );
}
