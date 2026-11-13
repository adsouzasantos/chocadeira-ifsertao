import { normalizeTelemetry, parseStatus, parseTopic, telemetryPayloadSchema } from "@chocadeira/shared";
import type { Logger } from "./logger";
import { TransientStoreError, type Store } from "./store";

export interface Stats {
  received: number;
  stored: number;
  rejected: number;
  retried: number;
  failed: number;
}

const MAX_PAYLOAD_BYTES = 4096;
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000, 60_000];

/**
 * Processa uma mensagem MQTT. Mensagens inválidas são descartadas com registro;
 * falhas temporárias do banco são repetidas com espera crescente.
 */
export function createHandler(store: Store, log: Logger) {
  const stats: Stats = { received: 0, stored: 0, rejected: 0, retried: 0, failed: 0 };

  async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const delay = RETRY_DELAYS_MS[attempt];
        if (err instanceof TransientStoreError && delay !== undefined) {
          stats.retried++;
          log.warn("Banco indisponível, nova tentativa", { label, em_ms: delay, erro: (err as Error).message });
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        stats.failed++;
        log.error("Falha ao gravar mensagem", { label, erro: (err as Error).message });
        return undefined;
      }
    }
  }

  async function handle(topic: string, payload: Buffer) {
    stats.received++;
    const route = parseTopic(topic);
    if (!route) {
      stats.rejected++;
      log.warn("Tópico fora do padrão", { topic });
      return;
    }
    if (payload.length > MAX_PAYLOAD_BYTES) {
      stats.rejected++;
      log.warn("Mensagem muito grande", { topic, bytes: payload.length });
      return;
    }
    const raw = payload.toString("utf8");

    if (route.kind === "status") {
      const online = parseStatus(raw);
      if (online === null) {
        stats.rejected++;
        log.warn("Status inválido", { topic, raw: raw.slice(0, 80) });
        return;
      }
      const result = await withRetry(topic, () => store.setDeviceStatus(route.deviceKey, online));
      if (result?.accepted) {
        stats.stored++;
        log.info(online ? "Dispositivo conectado" : "Dispositivo desconectado (Last Will)", { device: route.deviceKey });
      } else if (result) {
        stats.rejected++;
        log.warn("Status recusado", { device: route.deviceKey, motivo: result.reason });
      }
      return;
    }

    if (route.kind === "event") {
      // Eventos locais são apenas registrados nesta versão
      log.info("Evento do dispositivo", { device: route.deviceKey, evento: raw.slice(0, 200) });
      return;
    }

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      stats.rejected++;
      log.warn("JSON inválido", { device: route.deviceKey });
      return;
    }
    const parsed = telemetryPayloadSchema.safeParse(json);
    if (!parsed.success) {
      stats.rejected++;
      log.warn("Telemetria fora do contrato", {
        device: route.deviceKey,
        problemas: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`),
      });
      return;
    }

    const reading = normalizeTelemetry(parsed.data);
    if (reading.discarded.length) {
      log.warn("Valores fora da faixa plausível tratados como falha de sensor", {
        device: route.deviceKey,
        campos: reading.discarded,
      });
    }

    const result = await withRetry(topic, () => store.ingestReading(route.deviceKey, reading));
    if (!result) return;
    if (!result.accepted) {
      stats.rejected++;
      if (result.reason !== "duplicate") log.warn("Leitura recusada", { device: route.deviceKey, motivo: result.reason });
      return;
    }
    stats.stored++;
    if (result.clock_ok === false) log.warn("Relógio do dispositivo incoerente", { device: route.deviceKey });
    for (const e of result.events ?? []) {
      log.info(e.event === "opened" ? "Alarme aberto" : "Alarme encerrado", { device: route.deviceKey, tipo: e.type });
    }
    log.debug("Leitura gravada", { device: route.deviceKey, t: reading.temperatureC, u: reading.humidityPct });
  }

  return { handle, stats };
}
