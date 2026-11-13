"use client";

import { Cpu, ThermometerSun, Waves } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { connectionState, formatPct, formatRange, formatTemp, num, rangeStatus } from "@/lib/instrumentation";
import type { Alarm, IncubatorLive } from "@/lib/types";
import { AlarmItem } from "./alarm-list";
import { ConnectivityCard } from "./connectivity-card";
import { LiveStatus } from "./live-status";
import { MetricCard } from "./metric-card";
import { useLiveIncubators } from "./use-live";
import { WaterCard } from "./water-card";

/** Indicadores ao vivo de uma chocadeira e seus alarmes ativos. */
export function LivePanel({
  initial,
  initialAlarms,
  canEdit,
}: {
  initial: IncubatorLive;
  initialAlarms: Alarm[];
  canEdit: boolean;
}) {
  const { items, alarms, now, realtime, lastSync, refetch } = useLiveIncubators([initial], initialAlarms, {
    incubatorId: initial.id,
  });
  const item = items[0] ?? initial;
  const { device, settings } = item;

  if (!device) {
    return (
      <Card>
        <EmptyState
          icon={<Cpu aria-hidden className="size-6" />}
          title="Nenhum dispositivo vinculado"
          description="Cadastre o ESP32 desta chocadeira para receber temperatura, umidade e nível de água em tempo real."
          action={
            canEdit && <ButtonLink href={`/chocadeiras/${item.id}/dispositivo`}>Cadastrar dispositivo</ButtonLink>
          }
        />
      </Card>
    );
  }

  const state = connectionState(device, settings, now);
  const stale = state !== "online";
  const tMin = num(settings?.temp_min_c);
  const tMax = num(settings?.temp_max_c);
  const hMin = num(settings?.humidity_min_pct);
  const hMax = num(settings?.humidity_max_pct);
  const temp = num(device.last_temperature_c);
  const hum = num(device.last_humidity_pct);
  const neverReported = !device.last_measured_at;

  return (
    <div className="space-y-4">
      <LiveStatus realtime={realtime} lastSync={lastSync} now={now} />

      {neverReported && (
        <p className="rounded-lg border border-dashed border-border-strong px-4 py-3 text-sm text-text-muted">
          O dispositivo está cadastrado, mas ainda não enviou leituras. Confira a configuração do ESP32 na página do
          dispositivo.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Temperatura"
          icon={ThermometerSun}
          value={formatTemp(temp)}
          unit="°C"
          status={neverReported ? "nodata" : rangeStatus(temp, tMin, tMax)}
          severity="critical"
          min={tMin}
          max={tMax}
          rangeText={tMin !== null ? `${formatRange(tMin, tMax)} °C` : "não definida"}
          scale={[35, 40]}
          current={temp}
          stale={stale}
          seriesColor="var(--color-series-temperature)"
        />
        <MetricCard
          title="Umidade relativa"
          icon={Waves}
          value={formatPct(hum)}
          unit="%"
          status={neverReported ? "nodata" : rangeStatus(hum, hMin, hMax)}
          severity="warning"
          min={hMin}
          max={hMax}
          rangeText={hMin !== null ? `${formatPct(hMin)} a ${formatPct(hMax)}%` : "não definida"}
          scale={[20, 90]}
          current={hum}
          stale={stale}
          seriesColor="var(--color-series-humidity)"
        />
        <WaterCard level={device.last_water_level_pct} min={settings?.water_min_pct ?? 20} stale={stale} />
        <ConnectivityCard device={device} state={state} now={now} />
      </div>

      {alarms.length > 0 && (
        <section aria-label="Alarmes ativos">
          <h2 className="mb-2 text-sm font-semibold text-text">Alarmes ativos ({alarms.length})</h2>
          <ul className="space-y-2">
            {alarms.map((a) => (
              <AlarmItem key={a.id} alarm={a} now={now} canAcknowledge={canEdit} onChanged={refetch} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
