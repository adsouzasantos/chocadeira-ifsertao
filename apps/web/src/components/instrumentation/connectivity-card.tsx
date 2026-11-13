import { PlugZap, Radio, BatteryWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, signalQuality, timeAgo, type ConnectionState } from "@/lib/instrumentation";
import type { Device } from "@/lib/types";
import { ConnectionPill } from "./connection-pill";

function SignalBars({ bars }: { bars: number }) {
  return (
    <span className="inline-flex items-end gap-0.5" aria-hidden>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} className={cn("w-1 rounded-sm", b <= bars ? "bg-brand-600" : "bg-cream-300")} style={{ height: 4 + b * 3 }} />
      ))}
    </span>
  );
}

export function ConnectivityCard({ device, state, now }: { device: Device; state: ConnectionState; now: number }) {
  const signal = signalQuality(device.last_rssi);
  const problem = state === "offline" || state === "stale";

  return (
    <section
      aria-label="Conectividade"
      className={cn(
        "rounded-[var(--radius-card)] border bg-surface-raised p-4",
        state === "offline" ? "border-alert-500 shadow-[inset_0_0_0_1px_var(--color-alert-500)]" : state === "stale" ? "border-warning-500" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">Conectividade</h3>
        <Radio aria-hidden className="size-5 text-ink-400" />
      </div>
      <div className="mt-3">
        <ConnectionPill state={state} />
      </div>
      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Última comunicação</dt>
          <dd className={cn("font-medium tabular-nums", problem ? "text-alert-700" : "text-text")}>
            {timeAgo(device.last_seen_at, now)}
          </dd>
        </div>
        {problem && device.last_seen_at && (
          <div className="flex justify-between gap-2">
            <dt className="text-text-muted">Desde</dt>
            <dd className="tabular-nums">{formatDateTime(device.offline_since ?? device.last_seen_at)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-text-muted">Sinal Wi-Fi</dt>
          <dd className="flex items-center gap-2">
            <SignalBars bars={signal.bars} />
            {signal.label}
            {device.last_rssi !== null && <span className="text-xs text-text-muted">({device.last_rssi} dBm)</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-text-muted">Energia</dt>
          <dd className="flex items-center gap-1">
            {device.last_mains_power === false ? (
              <>
                <BatteryWarning aria-hidden className="size-4 text-alert-700" />
                <span className="font-medium text-alert-700">Na bateria</span>
              </>
            ) : device.last_mains_power ? (
              <>
                <PlugZap aria-hidden className="size-4 text-brand-600" />
                Rede elétrica
              </>
            ) : (
              <span className="text-text-muted">Sem dado</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
