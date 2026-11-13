import { z } from "zod";

const schema = z.object({
  MQTT_URL: z.string().regex(/^(mqtts?|wss?):\/\//, "MQTT_URL deve começar com mqtt://, mqtts://, ws:// ou wss://"),
  MQTT_USERNAME: z.string().optional(),
  MQTT_PASSWORD: z.string().optional(),
  MQTT_CLIENT_ID: z.string().min(1).default("ingestor-1"),
  SUPABASE_URL: z.url("SUPABASE_URL inválida"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY ausente"),
  TIMEOUT_CHECK_INTERVAL_S: z.coerce.number().int().min(10).max(600).default(30),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${String(i.path[0])}: ${i.message}`).join("\n");
    throw new Error(`Configuração inválida do serviço de ingestão:\n${problems}\nVeja apps/ingestor/.env.example.`);
  }
  return parsed.data;
}
