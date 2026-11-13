import { ChevronRight, Droplets, ThermometerSun, Waves } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { connectionState, formatPct, formatTemp, rangeStatus, timeAgo } from "@/lib/instrumentation";
import type { Alarm, IncubatorLive } from "@/lib/types";
import { ConnectionPill } from "./connection-pill";

function Reading({
  icon: Icon,
  label,
  value,
  unit,
  bad,
  critical,
}: {
  icon: typeof ThermometerSun;
  label: string;
  value: string;
  unit: string;
  bad: boolean;
  critical: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-text-muted">
        <Icon aria-hidden className="size-3.5" />
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-xl font-semibold tabular-nums",
          bad ? (critical ? "text-alert-700" : "text-warning-700") : "text-text",
        )}
      >
        {value}
        <span className="ml-0.5 text-sm font-normal text-text-muted">{unit}</span>
        {bad && <span className="sr-only"> (fora da faixa)</span>}
      </dd>
    </div>
  );
}

/** Resumo ao vivo de uma chocadeira, usado no painel e na lista. */
export function IncubatorLiveCard({ item, alarms, now }: { item: IncubatorLive; alarms: Alarm[]; now: number }) {
  const { device, settings } = item;
  const state = connectionState(device, settings, now);
  const active = alarms.filter((a) => a.incubator_id === item.id);
  const critical = active.some((a) => a.severity === "critical");
  const fresh = state === "online";
  const t = rangeStatus(device?.last_temperature_c, settings?.temp_min_c, settings?.temp_max_c);
  const h = rangeStatus(device?.last_humidity_pct, settings?.humidity_min_pct, settings?.humidity_max_pct);
  const w = device?.last_water_level_pct ?? null;
  const waterLow = w !== null && settings !== null && w < settings.water_min_pct;

  return (
    <Link
      href={`/chocadeiras/${item.id}`}
      className={cn(
        "group block rounded-[var(--radius-card)] border bg-surface-raised p-4 transition-colors hover:bg-white",
        critical ? "border-alert-500 shadow-[inset_0_0_0_1px_var(--color-alert-500)]" : active.length ? "border-warning-500" : "border-border hover:border-brand-300",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-text">{item.name}</p>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{item.code}</p>
        </div>
        <ConnectionPill state={state} />
      </div>

      {device ? (
        <dl className={cn("mt-4 grid grid-cols-3 gap-3", !fresh && "opacity-60")}>
          <Reading
            icon={ThermometerSun}
            label="Temperatura"
            value={formatTemp(device.last_temperature_c)}
            unit="°C"
            bad={t === "high" || t === "low" || t === "missing"}
            critical
          />
          <Reading
            icon={Waves}
            label="Umidade"
            value={formatPct(device.last_humidity_pct)}
            unit="%"
            bad={h === "high" || h === "low" || h === "missing"}
            critical={false}
          />
          <Reading icon={Droplets} label="Água" value={w === null ? "—" : String(w)} unit="%" bad={waterLow} critical />
        </dl>
      ) : (
        <p className="mt-4 text-sm text-text-muted">Nenhum dispositivo vinculado. Abra para cadastrar o ESP32.</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
        {active.length > 0 ? (
          <span className={cn("font-medium", critical ? "text-alert-700" : "text-warning-700")}>
            {active.length === 1 ? "1 alarme ativo" : `${active.length} alarmes ativos`}
          </span>
        ) : (
          <span className="text-text-muted">
            {device ? `Atualizado ${timeAgo(device.last_measured_at, now)}` : "Sem dados"}
          </span>
        )}
        <ChevronRight aria-hidden className="size-4 text-ink-400 group-hover:text-brand-600" />
      </div>
    </Link>
  );
}
