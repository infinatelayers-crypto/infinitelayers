import { SupportManager } from "@/components/admin/support-manager";
import { getAdminSupportMessages } from "@/lib/admin/data";

export default async function AdminSupportPage() {
  const messages = await getAdminSupportMessages();
  const open = messages.filter((m) => !m.handled).length;

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Inbox
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-fg">
          Support
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Messages from the help page.{open > 0 ? ` ${open} open.` : ""}
        </p>
      </header>
      <SupportManager messages={messages} />
    </div>
  );
}
