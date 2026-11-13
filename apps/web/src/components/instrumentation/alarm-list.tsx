"use client";

import { ALARM_LABELS, SEVERITY_LABELS } from "@chocadeira/shared";
import { BellRing, CheckCheck, CircleAlert, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { acknowledgeAlarm } from "@/app/(app)/alarmes/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { durationText, formatDateTime, num } from "@/lib/instrumentation";
import { initialFormState, type Alarm } from "@/lib/types";
import { cn } from "@/lib/utils";

const unitFor: Record<string, string> = {
  temperature_high: " °C",
  temperature_low: " °C",
  humidity_high: "%",
  humidity_low: "%",
  water_low: "%",
};

function fmt(v: unknown, type: string) {
  const n = num(v);
  if (n === null) return null;
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${unitFor[type] ?? ""}`;
}

function AckForm({ alarm, onDone }: { alarm: Alarm; onDone: () => void }) {
  const [state, action] = useActionState(acknowledgeAlarm.bind(null, alarm.id), initialFormState);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  return (
    <form action={action} className="mt-3 space-y-2">
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      <label htmlFor={`note-${alarm.id}`} className="text-sm font-medium">
        O que foi feito? <span className="font-normal text-text-muted">(opcional)</span>
      </label>
      <textarea
        id={`note-${alarm.id}`}
        name="note"
        maxLength={500}
        rows={2}
        defaultValue={alarm.resolution_note ?? ""}
        placeholder="Ex.: reservatório reabastecido às 14h"
        className="block w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/25"
      />
      <SubmitButton size="sm" pendingText="Registrando…">
        <CheckCheck aria-hidden className="size-4" />
        Confirmar reconhecimento
      </SubmitButton>
    </form>
  );
}

export function AlarmItem({
  alarm,
  incubatorName,
  now,
  canAcknowledge,
  onChanged,
}: {
  alarm: Alarm;
  incubatorName?: string;
  now: number;
  canAcknowledge: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = alarm.resolved_at === null;
  const critical = alarm.severity === "critical";
  const Icon = critical ? CircleAlert : TriangleAlert;
  const value = fmt(alarm.trigger_value, alarm.type);
  const peak = fmt(alarm.peak_value, alarm.type);
  const threshold = fmt(alarm.threshold, alarm.type);

  return (
    <li
      className={cn(
        "rounded-lg border p-3.5",
        active ? (critical ? "border-alert-100 bg-alert-50" : "border-warning-100 bg-warning-50") : "border-border bg-surface-raised",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden
          className={cn("mt-0.5 size-5 shrink-0", active ? (critical ? "text-alert-500" : "text-warning-500") : "text-ink-400")}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-semibold text-text">{ALARM_LABELS[alarm.type]}</p>
            <Badge tone={critical ? "danger" : "warning"}>{SEVERITY_LABELS[alarm.severity]}</Badge>
            {active ? (
              <Badge tone="info" icon={<BellRing aria-hidden className="size-3" />}>
                Ativo há {durationText(alarm.started_at, null, now)}
              </Badge>
            ) : (
              <Badge tone="neutral">Encerrado após {durationText(alarm.started_at, alarm.resolved_at)}</Badge>
            )}
            {alarm.acknowledged_at && (
              <Badge tone="success" icon={<CheckCheck aria-hidden className="size-3" />}>
                Reconhecido
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-700">
            {incubatorName && (
              <>
                <Link href={`/chocadeiras/${alarm.incubator_id}`} className="font-medium text-link hover:underline">
                  {incubatorName}
                </Link>
                {" · "}
              </>
            )}
            {alarm.message}
          </p>
          <p className="mt-1 text-xs text-text-muted tabular-nums">
            Início {formatDateTime(alarm.started_at)}
            {alarm.resolved_at && ` · Fim ${formatDateTime(alarm.resolved_at)}`}
            {value && ` · Valor ${value}`}
            {peak && peak !== value && ` · Pior ${peak}`}
            {threshold && ` · Limite ${threshold}`}
          </p>
          {alarm.resolution_note && <p className="mt-1.5 text-sm text-ink-700">Observação: {alarm.resolution_note}</p>}

          {canAcknowledge && !alarm.acknowledged_at && !open && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
              Reconhecer alarme
            </Button>
          )}
          {open && (
            <AckForm
              alarm={alarm}
              onDone={() => {
                setOpen(false);
                onChanged?.();
                router.refresh();
              }}
            />
          )}
        </div>
      </div>
    </li>
  );
}
