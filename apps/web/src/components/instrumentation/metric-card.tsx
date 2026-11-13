import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { num, type ValueStatus } from "@/lib/instrumentation";

interface MetricCardProps {
  title: string;
  icon: LucideIcon;
  value: string;
  unit: string;
  status: ValueStatus;
  /** Severidade quando fora da faixa: temperatura é crítica, umidade é atenção */
  severity: "critical" | "warning";
  min: number | null;
  max: number | null;
  rangeText: string;
  scale: [number, number];
  current: number | null;
  stale?: boolean;
  seriesColor: string;
}

const statusText: Record<ValueStatus, string> = {
  ok: "Dentro da faixa",
  high: "Acima do limite",
  low: "Abaixo do limite",
  missing: "Falha de leitura",
  nodata: "Sem leitura",
};

/**
 * Indicador de uma variável física: valor atual, faixa configurada e posição do
 * valor numa régua. O estado é dado por texto e ícone, não apenas pela cor.
 */
export function MetricCard(props: MetricCardProps) {
  const { title, icon: Icon, value, unit, status, severity, min, max, rangeText, scale, current, stale, seriesColor } = props;
  const out = status === "high" || status === "low";
  const bad = out || status === "missing";
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - scale[0]) / (scale[1] - scale[0])) * 100))}%`;
  const StatusIcon = stale
    ? Clock
    : status === "high"
      ? ArrowUp
      : status === "low"
        ? ArrowDown
        : bad
          ? CircleAlert
          : CircleCheck;

  return (
    <section
      aria-label={title}
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface-raised p-4",
        bad && !stale
          ? severity === "critical"
            ? "border-alert-500 shadow-[inset_0_0_0_1px_var(--color-alert-500)]"
            : "border-warning-500"
          : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <span className="size-2.5 rounded-full" style={{ background: seriesColor }} aria-hidden />
          {title}
        </h3>
        <Icon aria-hidden className="size-5 text-ink-400" />
      </div>

      <p className={cn("mt-2 flex items-baseline gap-1", stale && "opacity-50")}>
        <span className="text-4xl font-semibold tabular-nums tracking-tight text-text">{value}</span>
        <span className="text-lg text-text-muted">{unit}</span>
      </p>

      {/* Régua: faixa configurada em verde, valor atual como marcador */}
      <div className="relative mt-4 h-2 rounded-full bg-cream-200" aria-hidden>
        {min !== null && max !== null && (
          <div
            className="absolute inset-y-0 rounded-full bg-brand-200"
            style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }}
          />
        )}
        {current !== null && (
          <div
            className={cn(
              "absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white",
              out ? (severity === "critical" ? "bg-alert-500" : "bg-warning-500") : "bg-brand-700",
            )}
            style={{ left: pos(current) }}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[0.6875rem] tabular-nums text-ink-400" aria-hidden>
        <span>{num(scale[0])}</span>
        <span>{num(scale[1])}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium",
            stale
              ? "text-text-muted"
              : !bad
                ? "text-brand-700"
                : severity === "critical" || status === "missing"
                  ? "text-alert-700"
                  : "text-warning-700",
          )}
        >
          <StatusIcon aria-hidden className="size-4" />
          {stale ? "Leitura desatualizada" : statusText[status]}
        </span>
        <span className="text-text-muted">Faixa: {rangeText}</span>
      </div>
    </section>
  );
}
