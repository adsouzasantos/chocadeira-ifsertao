"use client";

import { ALARM_LABELS } from "@chocadeira/shared";
import { CircleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ALARM_COUNT_EVENT = "chocadeira:alarmes-ativos";

/**
 * Observa novos alarmes em qualquer página: mostra um aviso na tela, dispara a
 * notificação do navegador (se permitida) e atualiza o contador do menu.
 */
export function AlarmWatcher({ initialActive }: { initialActive: Array<Pick<Alarm, "id">> }) {
  const known = useRef(new Set(initialActive.map((a) => a.id)));
  const [toasts, setToasts] = useState<Alarm[]>([]);

  const check = useCallback(async () => {
    const { data, error } = await createClient()
      .from("alarms")
      .select("*, incubators(name)")
      .is("resolved_at", null)
      .order("started_at", { ascending: false });
    if (error || !data) return;
    const active = data as Array<Alarm & { incubators: { name: string } | null }>;
    window.dispatchEvent(new CustomEvent(ALARM_COUNT_EVENT, { detail: active.length }));

    const fresh = active.filter((a) => !known.current.has(a.id));
    known.current = new Set(active.map((a) => a.id));
    if (!fresh.length) return;

    setToasts((t) => [...fresh, ...t].slice(0, 3));
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      for (const a of fresh) {
        new Notification(`${ALARM_LABELS[a.type]}${a.incubators ? ` · ${a.incubators.name}` : ""}`, {
          body: a.message,
          tag: `alarme-${a.id}`,
          icon: "/icon.svg",
        });
      }
    }
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(ALARM_COUNT_EVENT, { detail: initialActive.length }));
    const poll = setInterval(() => void check(), 20_000);
    const supabase = createClient();
    const channel = supabase
      .channel("observador-alarmes")
      .on("postgres_changes", { event: "*", schema: "public", table: "alarms" }, () => void check())
      .subscribe();
    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [check, initialActive.length]);

  if (!toasts.length) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" role="alert">
      {toasts.map((a) => (
        <div
          key={a.id}
          className={cn(
            "flex gap-3 rounded-xl border bg-white p-4 shadow-lg",
            a.severity === "critical" ? "border-alert-500" : "border-warning-500",
          )}
        >
          <CircleAlert
            aria-hidden
            className={cn("mt-0.5 size-5 shrink-0", a.severity === "critical" ? "text-alert-500" : "text-warning-500")}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text">Novo alarme: {ALARM_LABELS[a.type]}</p>
            <p className="mt-0.5 text-sm text-ink-700">{a.message}</p>
            <Link href={`/chocadeiras/${a.incubator_id}`} className="mt-1.5 inline-block text-sm font-medium text-link hover:underline">
              Ver chocadeira
            </Link>
          </div>
          <button
            type="button"
            aria-label="Fechar aviso"
            onClick={() => setToasts((t) => t.filter((x) => x.id !== a.id))}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-ink-600 hover:bg-cream-200"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
