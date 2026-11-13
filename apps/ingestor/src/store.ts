import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedReading } from "@chocadeira/shared";

export interface IngestResult {
  accepted: boolean;
  reason?: string;
  clock_ok?: boolean;
  events?: Array<{ type: string; event: "opened" | "resolved" }>;
}

/** Erro de rede ou indisponibilidade: vale tentar novamente. */
export class TransientStoreError extends Error {}

/**
 * Acesso ao banco pelas funções RPC. Usa a chave service_role, que nunca sai
 * deste serviço.
 */
export function createStore(url: string, serviceRoleKey: string) {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let result;
    try {
      result = await db.rpc(fn, args);
    } catch (err) {
      throw new TransientStoreError(`Falha de rede ao chamar ${fn}: ${(err as Error).message}`);
    }
    const { data, error } = result;
    if (error) {
      // Erros 5xx, de conexão ou sem código são considerados temporários
      const transient = !error.code || error.code.startsWith("08") || error.code.startsWith("57") || error.code === "PGRST000";
      const message = `${fn}: ${error.message}${error.code ? ` (${error.code})` : ""}`;
      throw transient ? new TransientStoreError(message) : new Error(message);
    }
    return data as T;
  }

  return {
    ingestReading(deviceKey: string, r: NormalizedReading) {
      return rpc<IngestResult>("ingest_reading", {
        p_device_key: deviceKey,
        p_measured_at: r.measuredAt,
        p_temperature_c: r.temperatureC,
        p_humidity_pct: r.humidityPct,
        p_water_level_pct: r.waterLevelPct,
        p_rssi: r.rssi,
        p_seq: r.seq,
        p_replay: r.replay,
        p_firmware: r.firmware,
        p_mains_power: r.mainsPower,
      });
    },
    setDeviceStatus(deviceKey: string, online: boolean) {
      return rpc<IngestResult>("set_device_status", { p_device_key: deviceKey, p_online: online });
    },
    checkTimeouts() {
      return rpc<{ marked_offline: number; alarms_opened: number }>("check_device_timeouts", {});
    },
  };
}

export type Store = ReturnType<typeof createStore>;
