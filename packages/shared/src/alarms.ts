/** Rótulos dos tipos de alarme (mesmos valores do enum public.alarm_type). */
export type AlarmType =
  | "temperature_high"
  | "temperature_low"
  | "humidity_high"
  | "humidity_low"
  | "water_low"
  | "sensor_failure"
  | "device_offline";

export type AlarmSeverity = "critical" | "warning";

export const ALARM_LABELS: Record<AlarmType, string> = {
  temperature_high: "Temperatura alta",
  temperature_low: "Temperatura baixa",
  humidity_high: "Umidade alta",
  humidity_low: "Umidade baixa",
  water_low: "Nível de água baixo",
  sensor_failure: "Falha de sensor",
  device_offline: "Equipamento desconectado",
};

export const SEVERITY_LABELS: Record<AlarmSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
};
