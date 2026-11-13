import { z } from "zod";

/**
 * Contrato MQTT entre o ESP32 e a plataforma (versão 1).
 *
 * Tópicos (device_key é gerado pela plataforma ao cadastrar o dispositivo):
 *   chocadeira/v1/{device_key}/telemetry  ESP32 -> nuvem  QoS 1  não retido  leituras periódicas
 *   chocadeira/v1/{device_key}/status     ESP32 -> nuvem  QoS 1  retido      "online" | "offline" (Last Will)
 *   chocadeira/v1/{device_key}/event      ESP32 -> nuvem  QoS 1  não retido  eventos locais (reinício, alarme local)
 */
export const TOPIC_ROOT = "chocadeira/v1";

export const DEVICE_KEY_PATTERN = /^[a-z0-9-]{6,40}$/;

export const topics = {
  telemetry: (deviceKey: string) => `${TOPIC_ROOT}/${deviceKey}/telemetry`,
  status: (deviceKey: string) => `${TOPIC_ROOT}/${deviceKey}/status`,
  event: (deviceKey: string) => `${TOPIC_ROOT}/${deviceKey}/event`,
  /** Assinaturas usadas pelo serviço de ingestão */
  subscriptions: [`${TOPIC_ROOT}/+/telemetry`, `${TOPIC_ROOT}/+/status`, `${TOPIC_ROOT}/+/event`],
} as const;

export type TopicKind = "telemetry" | "status" | "event";

/** Extrai o dispositivo e o tipo de mensagem a partir do tópico. */
export function parseTopic(topic: string): { deviceKey: string; kind: TopicKind } | null {
  const parts = topic.split("/");
  if (parts.length !== 4 || `${parts[0]}/${parts[1]}` !== TOPIC_ROOT) return null;
  const deviceKey = parts[2] ?? "";
  const kind = parts[3];
  if (!DEVICE_KEY_PATTERN.test(deviceKey)) return null;
  if (kind !== "telemetry" && kind !== "status" && kind !== "event") return null;
  return { deviceKey, kind };
}

/** Faixas fisicamente plausíveis; fora delas a leitura é tratada como falha do sensor. */
export const PLAUSIBLE = {
  temperature_c: { min: -20, max: 80 },
  humidity_pct: { min: 0, max: 100 },
  water_level_pct: { min: 0, max: 100 },
} as const;

const optionalNumber = z.number().finite().nullable().optional();

export const telemetryPayloadSchema = z.object({
  v: z.literal(1),
  seq: z.number().int().nonnegative().max(2_147_483_647).optional(),
  ts: z.iso.datetime({ offset: true }).optional(),
  sensors: z.object({
    temperature_c: optionalNumber,
    humidity_pct: optionalNumber,
    water_level_pct: optionalNumber,
  }),
  actuators: z.record(z.string(), z.boolean()).optional(),
  diag: z
    .object({
      rssi: z.number().int().min(-127).max(0).optional(),
      uptime_s: z.number().int().nonnegative().optional(),
      fw: z.string().max(32).optional(),
      mains_power: z.boolean().optional(),
      replay: z.boolean().optional(),
    })
    .optional(),
});

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

export interface NormalizedReading {
  measuredAt: string | null;
  temperatureC: number | null;
  humidityPct: number | null;
  waterLevelPct: number | null;
  rssi: number | null;
  seq: number | null;
  replay: boolean;
  firmware: string | null;
  mainsPower: boolean | null;
  /** Campos descartados por estarem fora da faixa plausível */
  discarded: string[];
}

function plausible(value: number | null | undefined, range: { min: number; max: number }) {
  if (value === null || value === undefined) return null;
  return value >= range.min && value <= range.max ? value : undefined;
}

/** Converte a mensagem validada no formato gravado no banco. */
export function normalizeTelemetry(payload: TelemetryPayload): NormalizedReading {
  const discarded: string[] = [];
  const pick = (key: keyof typeof PLAUSIBLE) => {
    const v = plausible(payload.sensors[key], PLAUSIBLE[key]);
    if (v === undefined) {
      discarded.push(key);
      return null;
    }
    return v;
  };
  const water = pick("water_level_pct");
  return {
    measuredAt: payload.ts ?? null,
    temperatureC: pick("temperature_c"),
    humidityPct: pick("humidity_pct"),
    waterLevelPct: water === null ? null : Math.round(water),
    rssi: payload.diag?.rssi ?? null,
    seq: payload.seq ?? null,
    replay: payload.diag?.replay ?? false,
    firmware: payload.diag?.fw ?? null,
    mainsPower: payload.diag?.mains_power ?? null,
    discarded,
  };
}

/** Status aceita texto simples ("online"/"offline") ou JSON {"status": "..."}. */
export function parseStatus(raw: string): boolean | null {
  let value = raw.trim().toLowerCase();
  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value) as { status?: unknown };
      value = typeof parsed.status === "string" ? parsed.status : "";
    } catch {
      return null;
    }
  }
  if (value === "online") return true;
  if (value === "offline") return false;
  return null;
}
