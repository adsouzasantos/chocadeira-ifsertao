"use client";

import { BellOff, BellRing } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlarmItem } from "./alarm-list";

/** Permite receber avisos do navegador enquanto a plataforma estiver aberta. */
function BrowserNotifications() {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);
  if (perm === "unsupported") return null;
  if (perm === "granted") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-brand-700">
        <BellRing aria-hidden className="size-4" />
        Avisos do navegador ativados
      </p>
    );
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={perm === "denied"}
      title={perm === "denied" ? "Permissão negada nas configurações do navegador" : undefined}
      onClick={async () => setPerm(await Notification.requestPermission())}
    >
      {perm === "denied" ? <BellOff aria-hidden className="size-4" /> : <BellRing aria-hidden className="size-4" />}
      {perm === "denied" ? "Avisos bloqueados no navegador" : "Ativar avisos neste navegador"}
    </Button>
  );
}

export function AlarmCenter({
  active,
  history,
  names,
  canAcknowledge,
}: {
  active: Alarm[];
  history: Alarm[];
  names: Record<string, string>;
  canAcknowledge: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "history">("active");
  const [now, setNow] = useState(() => Date.now());

  // A lista é atualizada pelo servidor a cada 20 s
  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), 20_000);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [router]);

  const list = tab === "active" ? active : history;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Filtro de alarmes" className="inline-flex rounded-lg border border-border-strong bg-white p-0.5">
          {(
            [
              ["active", `Ativos (${active.length})`],
              ["history", `Histórico (${history.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                "h-9 rounded-md px-3 text-sm font-medium",
                tab === key ? "bg-brand-700 text-white" : "text-ink-700 hover:bg-cream-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <BrowserNotifications />
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellRing aria-hidden className="size-6" />}
            title={tab === "active" ? "Nenhum alarme ativo" : "Nenhum alarme nos últimos 30 dias"}
            description={
              tab === "active"
                ? "Todas as chocadeiras estão dentro das faixas configuradas."
                : "Os alarmes encerrados aparecem aqui com duração, pior valor e observações."
            }
          />
        </Card>
      ) : (
        <ul className="space-y-2" role="tabpanel">
          {list.map((a) => (
            <AlarmItem
              key={a.id}
              alarm={a}
              incubatorName={names[a.incubator_id]}
              now={now}
              canAcknowledge={canAcknowledge}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
