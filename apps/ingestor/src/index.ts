import { topics } from "@chocadeira/shared";
import mqtt from "mqtt";
import { loadConfig } from "./config";
import { createHandler } from "./handler";
import { createLogger } from "./logger";
import { createStore } from "./store";

let config: ReturnType<typeof loadConfig>;
try {
  config = loadConfig();
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
const log = createLogger(config.LOG_LEVEL);
const store = createStore(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
const { handle, stats } = createHandler(store, log);

log.info("Iniciando serviço de ingestão", { broker: config.MQTT_URL.replace(/\/\/.*@/, "//"), client: config.MQTT_CLIENT_ID });

// clean: false + client id fixo = sessão persistente: o broker guarda as
// mensagens QoS 1 enquanto este serviço estiver reiniciando
const client = mqtt.connect(config.MQTT_URL, {
  clientId: config.MQTT_CLIENT_ID,
  username: config.MQTT_USERNAME,
  password: config.MQTT_PASSWORD,
  clean: false,
  keepalive: 30,
  reconnectPeriod: 5_000,
  connectTimeout: 15_000,
});

// Processa as mensagens em ordem, uma de cada vez
let queue: Promise<void> = Promise.resolve();
let pending = 0;
client.on("message", (topic, payload) => {
  pending++;
  queue = queue
    .then(() => handle(topic, payload))
    .catch((err) => log.error("Erro inesperado no processamento", { erro: (err as Error).message }))
    .finally(() => {
      pending--;
    });
});

client.on("connect", (ack) => {
  log.info("Conectado ao broker", { sessao_retomada: ack.sessionPresent });
  client.subscribe([...topics.subscriptions], { qos: 1 }, (err, granted) => {
    if (err) return log.error("Falha ao assinar tópicos", { erro: err.message });
    log.info("Tópicos assinados", { topicos: granted?.map((g) => `${g.topic} (QoS ${g.qos})`) });
  });
});
client.on("reconnect", () => log.warn("Reconectando ao broker"));
client.on("offline", () => log.warn("Sem conexão com o broker"));
client.on("error", (err) => log.error("Erro MQTT", { erro: err.message }));

// Verificação periódica de equipamentos sem comunicação
const watchdog = setInterval(async () => {
  try {
    const r = await store.checkTimeouts();
    if (r.marked_offline || r.alarms_opened) log.info("Verificação de comunicação", r);
  } catch (err) {
    log.warn("Falha na verificação de comunicação", { erro: (err as Error).message });
  }
}, config.TIMEOUT_CHECK_INTERVAL_S * 1000);

const statsTimer = setInterval(() => log.info("Resumo", { ...stats, na_fila: pending }), 5 * 60_000);

async function shutdown(signal: string) {
  log.info("Encerrando", { sinal: signal });
  clearInterval(watchdog);
  clearInterval(statsTimer);
  await queue;
  client.end(false, {}, () => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
