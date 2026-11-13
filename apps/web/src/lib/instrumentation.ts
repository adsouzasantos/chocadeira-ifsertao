import type { AlarmSettings, Device, Incubator, IncubatorLive } from "./types";

/** Supabase devolve numeric como texto em alguns casos; normaliza para número. */
export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmt0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export const formatTemp = (v: unknown) => (num(v) === null ? "—" : fmt1.format(num(v)!));
export const formatPct = (v: unknown) => (num(v) === null ? "—" : fmt0.format(num(v)!));
export const formatRange = (min: unknown, max: unknown) => `${formatTemp(min)} a ${formatTemp(max)}`;

export type ConnectionState = "none" | "online" | "stale" | "offline";

/**
 * Estado de comunicação visto pelo usuário:
 *  online  = mensagens dentro da tolerância
 *  stale   = marcado online, mas sem mensagem além da tolerância (aguardando verificação)
 *  offline = desconectado
 */
export function connectionState(device: Device | null, settings: AlarmSettings | null, now = Date.now()): ConnectionState {
  if (!device) return "none";
  if (!device.online) return "offline";
  const timeout = (settings?.offline_timeout_s ?? 120) * 1000;
  if (!device.last_seen_at || now - Date.parse(device.last_seen_at) > timeout) return "stale";
  return "online";
}

export type ValueStatus = "ok" | "high" | "low" | "missing" | "nodata";

export function rangeStatus(value: unknown, min: unknown, max: unknown): ValueStatus {
  const v = num(value);
  if (v === null) return "missing";
  if (num(max) !== null && v > num(max)!) return "high";
  if (num(min) !== null && v < num(min)!) return "low";
  return "ok";
}

/** Tempo decorrido em linguagem simples: "há 25 s", "há 3 min", "há 2 h". */
export function timeAgo(iso: string | null, now = Date.now()) {
  if (!iso) return "nunca";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `há ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

export function durationText(fromIso: string, toIso: string | null, now = Date.now()) {
  const s = Math.max(0, Math.round(((toIso ? Date.parse(toIso) : now) - Date.parse(fromIso)) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function signalQuality(rssi: number | null) {
  if (rssi === null) return { label: "Sem dado", bars: 0 };
  if (rssi >= -60) return { label: "Ótimo", bars: 4 };
  if (rssi >= -70) return { label: "Bom", bars: 3 };
  if (rssi >= -80) return { label: "Regular", bars: 2 };
  return { label: "Fraco", bars: 1 };
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Fortaleza",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));


/** Colunas buscadas para os painéis (chocadeira + dispositivo + limites). */
export const LIVE_SELECT = "*, devices(*), alarm_settings(*)";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Normaliza a linha devolvida pela API (relações 1:1 podem vir como objeto ou lista). */
export function toIncubatorLive(row: Record<string, unknown>): IncubatorLive {
  const { devices, alarm_settings, ...rest } = row as Record<string, unknown> & {
    devices?: Device | Device[] | null;
    alarm_settings?: AlarmSettings | AlarmSettings[] | null;
  };
  return { ...(rest as unknown as Incubator), device: one(devices), settings: one(alarm_settings) };
}
