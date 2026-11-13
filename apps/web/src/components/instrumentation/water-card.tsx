import { CircleAlert, CircleCheck, Clock, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

/** Reservatório de água: nível em %, linha do mínimo configurado e aviso de reposição. */
export function WaterCard({ level, min, stale }: { level: number | null; min: number; stale?: boolean }) {
  const low = level !== null && level < min;
  const fill = level === null ? 0 : Math.min(100, Math.max(0, level));

  return (
    <section
      aria-label="Nível de água"
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface-raised p-4",
        low && !stale ? "border-alert-500 shadow-[inset_0_0_0_1px_var(--color-alert-500)]" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-text-muted">
          <span className="size-2.5 rounded-full bg-series-water" aria-hidden />
          Nível de água
        </h3>
        <Droplets aria-hidden className="size-5 text-ink-400" />
      </div>

      <div className={cn("mt-2 flex items-end gap-4", stale && "opacity-50")}>
        <p className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tabular-nums tracking-tight text-text">{level ?? "—"}</span>
          <span className="text-lg text-text-muted">%</span>
        </p>
        {/* Desenho do reservatório */}
        <div
          className="relative ml-auto h-20 w-14 overflow-hidden rounded-b-lg rounded-t-sm border-2 border-ink-400 bg-white"
          role="img"
          aria-label={level === null ? "Nível sem leitura" : `Reservatório com ${level}% de água`}
        >
          <div
            className={cn("absolute inset-x-0 bottom-0 transition-[height] duration-700", low ? "bg-alert-500/70" : "bg-series-water/60")}
            style={{ height: `${fill}%` }}
          />
          <div
            className="absolute inset-x-0 border-t-2 border-dashed border-alert-700"
            style={{ bottom: `${min}%` }}
            title={`Mínimo: ${min}%`}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        {stale && level !== null ? (
          <span className="inline-flex items-center gap-1 font-medium text-text-muted">
            <Clock aria-hidden className="size-4" />
            Leitura desatualizada
          </span>
        ) : level === null ? (
          <span className="inline-flex items-center gap-1 font-medium text-text-muted">Sem leitura</span>
        ) : low ? (
          <span className="inline-flex items-center gap-1 font-medium text-alert-700">
            <CircleAlert aria-hidden className="size-4" />
            Reponha a água
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 font-medium text-brand-700">
            <CircleCheck aria-hidden className="size-4" />
            Nível adequado
          </span>
        )}
        <span className="text-text-muted">Mínimo: {min}%</span>
      </div>
    </section>
  );
}
