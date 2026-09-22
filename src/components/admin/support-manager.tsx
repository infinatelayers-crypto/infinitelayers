"use client";

import { LoaderCircle, MailOpen, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSupportAction,
  updateSupportAction,
} from "@/app/admin/actions";
import type { SupportMessage } from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportManager({ messages }: { messages: SupportMessage[] }) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function toggleHandled(id: string, handled: boolean) {
    setError(undefined);
    startTransition(async () => {
      const result = await updateSupportAction(id, handled);
      if (!result.ok) setError(result.error ?? "Could not update.");
      else router.refresh();
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this message?")) return;
    setBusyId(id);
    const result = await deleteSupportAction(id);
    setBusyId(null);
    if (!result.ok) setError(result.error ?? "Could not delete.");
    else router.refresh();
  }

  if (!messages.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <MailOpen className="mx-auto text-fg-subtle" size={30} />
        <p className="mt-3 text-sm text-fg-muted">
          No support messages yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {messages.map((msg) => (
        <article
          key={msg.id}
          className={`rounded-2xl border bg-surface p-5 ${
            msg.handled ? "border-border opacity-70" : "border-accent/30"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display font-semibold text-fg">{msg.name}</p>
              <p className="mt-0.5 text-sm text-accent">{msg.contact}</p>
            </div>
            <p className="text-xs text-fg-subtle">{formatDate(msg.createdAt)}</p>
          </div>

          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-fg-muted">
            {msg.message}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <button
              type="button"
              disabled={pending}
              onClick={() => toggleHandled(msg.id, !msg.handled)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-muted transition hover:bg-surface-hover hover:text-fg disabled:opacity-50"
            >
              {msg.handled ? "Mark open" : "Mark handled"}
            </button>
            <button
              type="button"
              disabled={busyId === msg.id}
              onClick={() => remove(msg.id)}
              aria-label="Delete message"
              className="ml-auto rounded-lg p-1.5 text-fg-subtle transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
            >
              {busyId === msg.id ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Trash2 size={15} />
              )}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
