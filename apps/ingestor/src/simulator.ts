/**
 * Simulador de ESP32: publica telemetria no mesmo formato do firmware, para
 * testar a plataforma sem o hardware.
 *
 * Exemplos:
 *   npm run simulate -w @chocadeira/ingestor -- --dispositivo chc-1a2b3c4d5e6f
 *   npm run simulate -w @chocadeira/ingestor -- --dispositivo chc-... --cenario calor --intervalo 10
 *   npm run simulate -w @chocadeira/ingestor -- --dispositivo chc-... --historico 24 --leituras 0
 *
 * Cenários: normal, calor, frio, umidade-baixa, agua, falha-sensor, queda
 */
import { topics, type TelemetryPayload } from "@chocadeira/shared";
import mqtt from "mqtt";
import { parseArgs } from "node:util";

const SCENARIOS = ["normal", "calor", "frio", "umidade-baixa", "agua", "falha-sensor", "queda"] as const;
type Scenario = (typeof SCENARIOS)[number];

const { values: args } = parseArgs({
  options: {
    dispositivo: { type: "string", default: process.env.SIM_DEVICE_KEY },
    url: { type: "string", default: process.env.MQTT_URL },
    usuario: { type: "string", default: process.env.SIM_MQTT_USERNAME },
    senha: { type: "string", default: process.env.SIM_MQTT_PASSWORD },
    cenario: { type: "string", default: "normal" },
    intervalo: { type: "string", default: "30" },
    historico: { type: "string", default: "0" },
    leituras: { type: "string", default: "0" },
  },
});

const deviceKey = args.dispositivo ?? "";
const scenario = args.cenario as Scenario;
const intervalS = Number(args.intervalo);
const historyHours = Number(args.historico);
const maxReadings = Number(args.leituras);

if (!deviceKey || !args.url) {
  console.error("Informe --dispositivo e --url (ou SIM_DEVICE_KEY e MQTT_URL no .env).");
  process.exit(1);
}
if (!SCENARIOS.includes(scenario)) {
  console.error(`Cenário inválido. Use: ${SCENARIOS.join(", ")}`);
  process.exit(1);
}

// Estado físico simulado
let temperature = 37.5;
let humidity = 55;
let water = 85;
let seq = 0;
let count = 0;

const noise = (amplitude: number) => (Math.random() * 2 - 1) * amplitude;
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Avança o estado conforme o cenário e devolve a leitura. */
function step(): TelemetryPayload["sensors"] {
  const pull = (value: number, target: number, rate: number) => value + (target - value) * rate;
  const ramping = count >= 3;

  switch (scenario) {
    case "calor":
      temperature = ramping ? Math.min(39.2, temperature + 0.15) : pull(temperature, 37.5, 0.3);
      break;
    case "frio":
      temperature = ramping ? Math.max(35.5, temperature - 0.15) : pull(temperature, 37.5, 0.3);
      break;
    default:
      temperature = pull(temperature, 37.5, 0.3);
  }
  temperature += noise(0.08);

  humidity = scenario === "umidade-baixa" && ramping ? Math.max(40, humidity - 1.2) : pull(humidity, 55, 0.2);
  humidity += noise(0.8);

  if (scenario === "agua" && ramping) water = Math.max(5, water - 6);
  else water = water < 30 ? 85 : water - 0.05;

  if (scenario === "falha-sensor" && ramping) {
    return { temperature_c: null, humidity_pct: null, water_level_pct: Math.round(water) };
  }
  return {
    temperature_c: round(temperature, 2),
    humidity_pct: round(clamp(humidity, 0, 100), 1),
    water_level_pct: Math.round(clamp(water, 0, 100)),
  };
}

function payload(sensors: TelemetryPayload["sensors"], ts: Date, replay = false): string {
  const message: TelemetryPayload = {
    v: 1,
    seq: seq++,
    ts: ts.toISOString(),
    sensors,
    actuators: { heater: (sensors.temperature_c ?? 37.5) < 37.5, humidifier: (sensors.humidity_pct ?? 55) < 55 },
    diag: { rssi: Math.round(-62 + noise(6)), uptime_s: Math.round(process.uptime()), fw: "sim-1.0.0", mains_power: true, replay },
  };
  return JSON.stringify(message);
}

const client = mqtt.connect(args.url, {
  clientId: deviceKey,
  username: args.usuario,
  password: args.senha,
  clean: true,
  keepalive: 30,
  will: { topic: topics.status(deviceKey), payload: Buffer.from("offline"), qos: 1, retain: true },
});

client.on("error", (err) => {
  console.error("Erro MQTT:", err.message);
});

client.on("connect", async () => {
  console.log(`Conectado como ${deviceKey}. Cenário: ${scenario}. Intervalo: ${intervalS}s.`);
  await client.publishAsync(topics.status(deviceKey), "online", { qos: 1, retain: true });

  if (historyHours > 0) {
    // Histórico das últimas horas (uma leitura a cada 5 min), marcado como reenvio
    const points = Math.floor((historyHours * 3600) / 300);
    console.log(`Publicando ${points} leituras de histórico (${historyHours} h)…`);
    for (let i = points; i > 0; i--) {
      const ts = new Date(Date.now() - i * 300_000);
      const hour = ts.getUTCHours() - 3;
      // Pequena variação diária, como acontece com a temperatura ambiente
      temperature = 37.5 + 0.12 * Math.sin((hour / 24) * 2 * Math.PI) + noise(0.08);
      humidity = 55 + 2 * Math.cos((hour / 24) * 2 * Math.PI) + noise(0.8);
      water = water < 30 ? 85 : water - 0.25;
      await client.publishAsync(
        topics.telemetry(deviceKey),
        payload(
          { temperature_c: round(temperature, 2), humidity_pct: round(humidity, 1), water_level_pct: Math.round(water) },
          ts,
          true,
        ),
        { qos: 1 },
      );
    }
    console.log("Histórico publicado.");
  }

  if (maxReadings === 0 && historyHours > 0) {
    client.end();
    return;
  }

  const tick = async () => {
    const sensors = step();
    count++;
    await client.publishAsync(topics.telemetry(deviceKey), payload(sensors, new Date()), { qos: 1 });
    console.log(
      `#${count} T=${sensors.temperature_c ?? "falha"} °C  UR=${sensors.humidity_pct ?? "falha"} %  água=${sensors.water_level_pct} %`,
    );

    if (scenario === "queda" && count >= 5) {
      console.log("Simulando queda de energia: conexão interrompida sem aviso (o broker publica o Last Will).");
      client.stream.destroy();
      clearInterval(timer);
      setTimeout(() => process.exit(0), 500);
      return;
    }
    if (maxReadings > 0 && count >= maxReadings) {
      clearInterval(timer);
      client.end();
    }
  };

  const timer = setInterval(() => void tick(), intervalS * 1000);
  void tick();
});

process.on("SIGINT", () => {
  console.log("\nEncerrando simulador (desconexão normal).");
  client.publish(topics.status(deviceKey), "offline", { qos: 1, retain: true }, () => client.end());
  setTimeout(() => process.exit(0), 1000).unref();
});
