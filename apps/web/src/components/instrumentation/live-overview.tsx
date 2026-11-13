"use client";

import { Bell, Plus, ThermometerSun, Wifi } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { connectionState } from "@/lib/instrumentation";
import type { Alarm, IncubatorLive } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlarmItem } from "./alarm-list";
import { IncubatorLiveCard } from "./incubator-live-card";
import { LiveStatus } from "./live-status";
import { useLiveIncubators } from "./use-live";

function Kpi({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "danger" | "warning";
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface-raised p-4",
        tone === "danger" ? "border-alert-500" : tone === "warning" ? "border-warning-500" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-muted">{label}</p>
        <span className={tone === "danger" ? "text-alert-500" : tone === "warning" ? "text-warning-500" : "text-brand-600"}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-text">{value}</p>
      {detail && <p className="mt-1 text-xs text-text-muted">{detail}</p>}
    </div>
  );
}

/** Visão geral ao vivo: indicadores, chocadeiras e alarmes ativos. */
export function LiveOverview({
  initial,
  initialAlarms,
  showKpis = true,
  showAlarms = true,
  canAcknowledge,
}: {
  initial: IncubatorLive[];
  initialAlarms: Alarm[];
  showKpis?: boolean;
  showAlarms?: boolean;
  canAcknowledge: boolean;
}) {
  const { items, alarms, now, realtime, lastSync, refetch } = useLiveIncubators(initial, initialAlarms);
  const withDevice = items.filter((i) => i.device);
  const online = withDevice.filter((i) => connectionState(i.device, i.settings, now) === "online").length;
  const critical = alarms.filter((a) => a.severity === "critical").length;
  const names = new Map(items.map((i) => [i.id, i.name]));

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<ThermometerSun aria-hidden className="size-6" />}
          title="Nenhuma chocadeira cadastrada"
          description="Cadastre a chocadeira e depois vincule o ESP32 para acompanhar temperatura, umidade e nível de água."
          action={
            <ButtonLink href="/chocadeiras/nova">
              <Plus aria-hidden className="size-5" />
              Cadastrar chocadeira
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {showKpis && (
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Kpi
            label="Chocadeiras"
            value={String(items.length)}
            detail={`${withDevice.length} com dispositivo`}
            icon={<ThermometerSun aria-hidden className="size-5" />}
          />
          <Kpi
            label="Equipamentos online"
            value={`${online} de ${withDevice.length}`}
            detail={withDevice.length - online > 0 ? `${withDevice.length - online} sem comunicação` : "Todos comunicando"}
            icon={<Wifi aria-hidden className="size-5" />}
            tone={withDevice.length - online > 0 ? "warning" : "neutral"}
          />
          <div className="col-span-2 lg:col-span-1">
            <Kpi
              label="Alarmes ativos"
              value={String(alarms.length)}
              detail={alarms.length ? `${critical} crítico(s), ${alarms.length - critical} de atenção` : "Nenhuma ocorrência"}
              icon={<Bell aria-hidden className="size-5" />}
              tone={critical ? "danger" : alarms.length ? "warning" : "neutral"}
            />
          </div>
        </section>
      )}

      <LiveStatus realtime={realtime} lastSync={lastSync} now={now} />

      {showAlarms && alarms.length > 0 && (
        <section aria-label="Alarmes ativos">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-semibold">Alarmes ativos</h2>
            <Link href="/alarmes" className="text-sm font-medium text-link hover:underline">
              Central de alarmes
            </Link>
          </div>
          <ul className="space-y-2">
            {alarms.slice(0, 5).map((a) => (
              <AlarmItem
                key={a.id}
                alarm={a}
                incubatorName={names.get(a.incubator_id)}
                now={now}
                canAcknowledge={canAcknowledge}
                onChanged={refetch}
              />
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Chocadeiras">
        {showKpis && <h2 className="mb-2 text-base font-semibold">Chocadeiras</h2>}
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <IncubatorLiveCard item={item} alarms={alarms} now={now} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
