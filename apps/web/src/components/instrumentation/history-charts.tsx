"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { num } from "@/lib/instrumentation";
import type { AlarmSettings, AlarmType, SeriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EChart, type EChartsOption } from "./echart";

type RangeKey = "1h" | "6h" | "24h" | "7d" | "custom";

const RANGES: Array<{ key: Exclude<RangeKey, "custom">; label: string; ms: number }> = [
  { key: "1h", label: "1 h", ms: 3_600_000 },
  { key: "6h", label: "6 h", ms: 6 * 3_600_000 },
  { key: "24h", label: "24 h", ms: 24 * 3_600_000 },
  { key: "7d", label: "7 dias", ms: 7 * 24 * 3_600_000 },
];

const POINTS = 240;
const TZ = "America/Fortaleza";

/* Cores lidas dos design tokens (validadas para contraste e daltonismo) */
const COLORS = {
  temperature: "#018d3e",
  humidity: "#1d6fa5",
  water: "#b2650a",
  band: "rgba(1, 141, 62, 0.09)",
  alarm: "rgba(231, 21, 6, 0.10)",
  grid: "#eedfb6",
  axis: "#4f5b52",
};

interface AlarmSpan {
  type: AlarmType;
  started_at: string;
  resolved_at: string | null;
}

const fmtNumber = (v: number, d: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

function toLocalInput(ms: number) {
  // Valor para <input type="datetime-local"> no fuso do semiárido (UTC-3, sem horário de verão)
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 16);
}
function fromLocalInput(value: string) {
  return Date.parse(`${value}:00-03:00`);
}

function axisFormatter(spanMs: number) {
  const f =
    spanMs > 36 * 3_600_000
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: TZ })
      : new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
  return (value: number) => f.format(new Date(value));
}

const tooltipTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TZ,
});

interface SeriesSpec {
  key: "temperature" | "humidity" | "water";
  title: string;
  unit: string;
  decimals: number;
  color: string;
  avg: (p: SeriesPoint) => number | null;
  min?: (p: SeriesPoint) => number | null;
  max?: (p: SeriesPoint) => number | null;
  band: [number, number] | null;
  floor?: number | null;
  alarmTypes: AlarmType[];
  height: number;
}

function summary(values: number[]) {
  if (!values.length) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return { avg: sum / values.length, min: Math.min(...values), max: Math.max(...values) };
}

/** Opções do ECharts para uma variável: linha da média, faixa configurada e períodos em alarme. */
function buildOption(
  spec: SeriesSpec,
  points: SeriesPoint[],
  alarms: AlarmSpan[],
  from: number,
  to: number,
): EChartsOption {
  const step = Math.max(30_000, (to - from) / POINTS);
  const data: Array<{ value: [number, number | null]; min?: number | null; max?: number | null }> = [];
  let prev: number | null = null;
  for (const p of points) {
    const t = Date.parse(p.bucket);
    // Intervalo sem leituras (equipamento desligado ou sem rede): interrompe a linha
    if (prev !== null && t - prev > step * 3) data.push({ value: [prev + step, null] });
    data.push({ value: [t, num(spec.avg(p))], min: spec.min ? num(spec.min(p)) : null, max: spec.max ? num(spec.max(p)) : null });
    prev = t;
  }

  const values = data.map((d) => d.value[1]).filter((v): v is number => v !== null);
  const limits = [...(spec.band ?? []), ...(spec.floor != null ? [spec.floor] : [])];
  const lo = Math.min(...values, ...limits);
  const hi = Math.max(...values, ...limits);
  // Limites do eixo alinhados a passos "redondos", para os rótulos não se sobreporem
  const tick = spec.key === "temperature" ? 0.5 : 5;
  const pad = spec.key === "temperature" ? 0.2 : 2;
  const yMin = spec.key === "water" ? 0 : Math.floor((lo - pad) / tick) * tick;
  const yMax = spec.key === "water" ? 100 : Math.ceil((hi + pad) / tick) * tick;

  const areas: unknown[] = [];
  if (spec.band) areas.push([{ yAxis: spec.band[0], itemStyle: { color: COLORS.band } }, { yAxis: spec.band[1] }]);
  for (const a of alarms.filter((x) => spec.alarmTypes.includes(x.type))) {
    areas.push([
      { xAxis: Math.max(from, Date.parse(a.started_at)), itemStyle: { color: COLORS.alarm } },
      { xAxis: Math.min(to, a.resolved_at ? Date.parse(a.resolved_at) : to) },
    ]);
  }

  return {
    animation: false,
    grid: { left: 44, right: 12, top: 12, bottom: 24 },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: COLORS.axis, type: "dashed" } },
      backgroundColor: "#fffdf8",
      borderColor: COLORS.grid,
      textStyle: { color: "#1f2a22", fontSize: 13 },
      formatter: (params: unknown) => {
        const p = (Array.isArray(params) ? params[0] : params) as { data: (typeof data)[number] } | undefined;
        if (!p?.data || p.data.value[1] === null) return "";
        const [t, v] = p.data.value;
        const range =
          p.data.min != null && p.data.max != null && p.data.min !== p.data.max
            ? `<br/><span style="color:#4f5b52">mín ${fmtNumber(p.data.min, spec.decimals)} · máx ${fmtNumber(p.data.max, spec.decimals)}</span>`
            : "";
        return `${tooltipTime.format(new Date(t))}<br/><b>${spec.title}: ${fmtNumber(v as number, spec.decimals)}${spec.unit}</b>${range}`;
      },
    },
    xAxis: {
      type: "time",
      min: from,
      max: to,
      axisLine: { lineStyle: { color: COLORS.grid } },
      axisTick: { show: false },
      axisLabel: { color: COLORS.axis, fontSize: 11, formatter: axisFormatter(to - from), hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: yMin,
      max: yMax,
      interval: spec.key === "water" ? 25 : Math.max(tick, Math.ceil((yMax - yMin) / tick / 4) * tick),
      axisLabel: {
        color: COLORS.axis,
        fontSize: 11,
        formatter: (v: number) => fmtNumber(v, spec.key === "temperature" ? 1 : 0),
      },
      splitLine: { lineStyle: { color: COLORS.grid, opacity: 0.6 } },
    },
    series: [
      {
        type: "line",
        name: spec.title,
        data,
        // Poucos pontos: mostra os marcadores para que leituras isoladas fiquem visíveis
        showSymbol: values.length < 30,
        symbolSize: 8,
        connectNulls: false,
        lineStyle: { width: 2, color: spec.color },
        itemStyle: { color: spec.color },
        emphasis: { disabled: true },
        markArea: { silent: true, data: areas },
        markLine:
          spec.floor != null
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: "#b81104", type: "dashed", width: 1 },
                label: { formatter: `mínimo ${spec.floor}%`, color: "#b81104", fontSize: 11, position: "insideEndTop" },
                data: [{ yAxis: spec.floor }],
              }
            : undefined,
      },
    ],
  };
}

export function HistoryCharts({ incubatorId, settings }: { incubatorId: string; settings: AlarmSettings | null }) {
  const [range, setRange] = useState<RangeKey>("24h");
  const [custom, setCustom] = useState(() => ({
    from: toLocalInput(Date.now() - 48 * 3_600_000),
    to: toLocalInput(Date.now()),
  }));
  const [window_, setWindow] = useState(() => ({ from: Date.now() - 24 * 3_600_000, to: Date.now() }));
  const [points, setPoints] = useState<SeriesPoint[]>([]);
  const [alarms, setAlarms] = useState<AlarmSpan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (from: number, to: number) => {
      setLoading(true);
      setError(null);
      const supabase = createClient();
      const fromIso = new Date(from).toISOString();
      const toIso = new Date(to).toISOString();
      const [series, al] = await Promise.all([
        supabase.rpc("telemetry_series", {
          p_incubator_id: incubatorId,
          p_from: fromIso,
          p_to: toIso,
          p_points: POINTS,
        }),
        supabase
          .from("alarms")
          .select("type, started_at, resolved_at")
          .eq("incubator_id", incubatorId)
          .lt("started_at", toIso)
          .or(`resolved_at.is.null,resolved_at.gt.${fromIso}`),
      ]);
      if (series.error) setError("Não foi possível carregar o histórico. Verifique a conexão e tente novamente.");
      else {
        setPoints((series.data ?? []) as SeriesPoint[]);
        setAlarms((al.data ?? []) as AlarmSpan[]);
        setWindow({ from, to });
      }
      setLoading(false);
    },
    [incubatorId],
  );

  // Intervalos relativos ("últimas N horas") são atualizados a cada minuto
  useEffect(() => {
    if (range === "custom") return;
    const ms = RANGES.find((r) => r.key === range)!.ms;
    const run = () => void load(Date.now() - ms, Date.now());
    run();
    const timer = setInterval(run, 60_000);
    return () => clearInterval(timer);
  }, [range, load]);

  const customFrom = fromLocalInput(custom.from);
  const customTo = fromLocalInput(custom.to);
  const customError =
    !Number.isFinite(customFrom) || !Number.isFinite(customTo)
      ? "Informe início e fim."
      : customFrom >= customTo
        ? "O início deve ser anterior ao fim."
        : customTo - customFrom > 92 * 24 * 3_600_000
          ? "Selecione no máximo 92 dias."
          : null;

  const specs: SeriesSpec[] = useMemo(
    () => [
      {
        key: "temperature",
        title: "Temperatura",
        unit: " °C",
        decimals: 1,
        color: COLORS.temperature,
        avg: (p) => p.temperature_avg,
        min: (p) => p.temperature_min,
        max: (p) => p.temperature_max,
        band: settings ? [num(settings.temp_min_c)!, num(settings.temp_max_c)!] : null,
        alarmTypes: ["temperature_high", "temperature_low"],
        height: 220,
      },
      {
        key: "humidity",
        title: "Umidade relativa",
        unit: "%",
        decimals: 0,
        color: COLORS.humidity,
        avg: (p) => p.humidity_avg,
        min: (p) => p.humidity_min,
        max: (p) => p.humidity_max,
        band: settings ? [num(settings.humidity_min_pct)!, num(settings.humidity_max_pct)!] : null,
        alarmTypes: ["humidity_high", "humidity_low"],
        height: 200,
      },
      {
        key: "water",
        title: "Nível de água",
        unit: "%",
        decimals: 0,
        color: COLORS.water,
        avg: (p) => p.water_level_avg,
        band: null,
        floor: settings ? num(settings.water_min_pct) : null,
        alarmTypes: ["water_low"],
        height: 150,
      },
    ],
    [settings],
  );

  const group = `historico-${incubatorId}`;
  const empty = !loading && !error && points.length === 0;

  return (
    <div>
      {/* Seleção de período: uma única linha de controles acima dos gráficos */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <div role="group" aria-label="Período" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-border-strong bg-white p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                "h-9 shrink-0 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3",
                range === r.key ? "bg-brand-700 text-white" : "text-ink-700 hover:bg-cream-200",
              )}
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={range === "custom"}
            onClick={() => setRange("custom")}
            className={cn(
              "h-9 shrink-0 rounded-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3",
              range === "custom" ? "bg-brand-700 text-white" : "text-ink-700 hover:bg-cream-200",
            )}
          >
            Personalizado
          </button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Atualizar gráficos"
          onClick={() => void load(range === "custom" ? window_.from : Date.now() - (window_.to - window_.from), range === "custom" ? window_.to : Date.now())}
        >
          {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : <RefreshCw aria-hidden className="size-4" />}
          Atualizar
        </Button>
      </div>

      {range === "custom" && (
        <form
          className="flex flex-wrap items-end gap-3 border-b border-border bg-cream-50 px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!customError) void load(customFrom, customTo);
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium">Início</span>
            <input
              type="datetime-local"
              value={custom.from}
              onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
              className="h-10 rounded-lg border border-border-strong bg-white px-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Fim</span>
            <input
              type="datetime-local"
              value={custom.to}
              onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
              className="h-10 rounded-lg border border-border-strong bg-white px-2"
            />
          </label>
          <Button type="submit" size="sm" disabled={!!customError}>
            Aplicar
          </Button>
          {customError && <p className="w-full text-sm text-alert-700">{customError}</p>}
        </form>
      )}

      <div className="space-y-1 px-2 py-3 sm:px-3">
        {error && (
          <div className="px-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        {empty && (
          <p className="px-3 py-10 text-center text-sm text-text-muted">
            Nenhuma leitura neste período. As leituras aparecem aqui assim que o ESP32 começar a enviar dados.
          </p>
        )}
        {!error &&
          !empty &&
          specs.map((spec) => {
            const vals = points.map(spec.avg).map(num).filter((v): v is number => v !== null);
            const s = summary(vals);
            return (
              <figure key={spec.key} className={cn("px-3 pb-2", loading && points.length === 0 && "opacity-40")}>
                <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 pt-2">
                  <span className="flex items-center gap-2 text-sm font-semibold text-text">
                    <span className="h-0.5 w-4 rounded-full" style={{ background: spec.color }} aria-hidden />
                    {spec.title} ({spec.unit.trim()})
                  </span>
                  {s && (
                    <span className="text-xs tabular-nums text-text-muted">
                      média {fmtNumber(s.avg, spec.decimals)} · mín {fmtNumber(s.min, spec.decimals)} · máx{" "}
                      {fmtNumber(s.max, spec.decimals)}
                    </span>
                  )}
                </figcaption>
                <EChart
                  group={group}
                  height={spec.height}
                  ariaLabel={`Gráfico de ${spec.title.toLowerCase()} no período selecionado`}
                  option={buildOption(spec, points, alarms, window_.from, window_.to)}
                />
              </figure>
            );
          })}
      </div>

      {!empty && points.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-5 py-3 text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: COLORS.band, outline: "1px solid #9bd3b0" }} aria-hidden />
            Faixa configurada
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: COLORS.alarm, outline: "1px solid #fad1cc" }} aria-hidden />
            Período em alarme
          </span>
          <span>Linha interrompida: período sem leituras</span>
        </div>
      )}

      {/* Visão em tabela, para leitores de tela e para conferência dos valores */}
      {points.length > 0 && (
        <details className="border-t border-border px-5 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-link">Ver dados em tabela</summary>
          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">Médias por intervalo, mais recentes primeiro</caption>
              <thead className="sticky top-0 bg-cream-200 text-xs text-ink-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Horário</th>
                  <th className="px-3 py-2 font-medium">Temperatura (°C)</th>
                  <th className="px-3 py-2 font-medium">Umidade (%)</th>
                  <th className="px-3 py-2 font-medium">Água (%)</th>
                </tr>
              </thead>
              <tbody>
                {[...points]
                  .reverse()
                  .slice(0, 100)
                  .map((p) => (
                    <tr key={p.bucket} className="border-t border-border">
                      <td className="px-3 py-1.5">{tooltipTime.format(new Date(p.bucket))}</td>
                      <td className="px-3 py-1.5">{num(p.temperature_avg) === null ? "—" : fmtNumber(num(p.temperature_avg)!, 1)}</td>
                      <td className="px-3 py-1.5">{num(p.humidity_avg) === null ? "—" : fmtNumber(num(p.humidity_avg)!, 0)}</td>
                      <td className="px-3 py-1.5">{num(p.water_level_avg) ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
