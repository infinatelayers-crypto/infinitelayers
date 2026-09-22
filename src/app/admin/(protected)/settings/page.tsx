import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdmin } from "@/lib/admin/auth";
import { getStoreSettings } from "@/lib/settings";

export default async function AdminSettingsPage() {
  await requireAdmin();
  const settings = await getStoreSettings();

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Store
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg">
          Settings
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Edit your landing page text, contact links, and delivery charges.
        </p>
      </header>
      <SettingsForm settings={settings} />
    </div>
  );
}
