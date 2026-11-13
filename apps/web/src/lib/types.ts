/**
 * Tipos das tabelas usadas pela aplicação. Quando o projeto Supabase estiver
 * criado, podem ser substituídos pelos tipos gerados com
 * `npx supabase gen types typescript --project-id <id>`.
 */
export type OrgRole = "owner" | "operator" | "viewer";

export interface Profile {
  id: string;
  full_name: string;
  created_at: string;
  updated_at: string;
}

export interface Incubator {
  id: string;
  organization_id: string;
  name: string;
  code: string;
  description: string | null;
  model: string | null;
  egg_capacity: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Estado devolvido pelas Server Actions aos formulários. */
export interface FormState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Valores enviados, para repreencher o formulário após um erro. */
  values?: Record<string, string>;
}

export const initialFormState: FormState = { ok: false };

export interface Device {
  id: string;
  organization_id: string;
  incubator_id: string | null;
  device_key: string;
  label: string | null;
  firmware_version: string | null;
  online: boolean;
  last_seen_at: string | null;
  offline_since: string | null;
  last_measured_at: string | null;
  last_temperature_c: number | null;
  last_humidity_pct: number | null;
  last_water_level_pct: number | null;
  last_rssi: number | null;
  last_mains_power: boolean | null;
  created_at: string;
}

export interface AlarmSettings {
  incubator_id: string;
  temp_min_c: number;
  temp_max_c: number;
  humidity_min_pct: number;
  humidity_max_pct: number;
  water_min_pct: number;
  alarm_delay_s: number;
  offline_timeout_s: number;
  preset: string | null;
  updated_at: string;
}

export type AlarmType =
  | "temperature_high"
  | "temperature_low"
  | "humidity_high"
  | "humidity_low"
  | "water_low"
  | "sensor_failure"
  | "device_offline";

export interface Alarm {
  id: number;
  organization_id: string;
  incubator_id: string;
  device_id: string | null;
  type: AlarmType;
  severity: "critical" | "warning";
  message: string;
  trigger_value: number | null;
  threshold: number | null;
  peak_value: number | null;
  started_at: string;
  resolved_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolution_note: string | null;
}

export interface SeriesPoint {
  bucket: string;
  temperature_avg: number | null;
  temperature_min: number | null;
  temperature_max: number | null;
  humidity_avg: number | null;
  humidity_min: number | null;
  humidity_max: number | null;
  water_level_avg: number | null;
  samples: number;
}

/** Chocadeira com dispositivo e limites, como usada nos painéis. */
export interface IncubatorLive extends Incubator {
  device: Device | null;
  settings: AlarmSettings | null;
}
