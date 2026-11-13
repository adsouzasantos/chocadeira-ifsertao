# Chocadeira Inteligente · IFSertãoPB

Plataforma web de **instrumentação e monitoramento de chocadeiras**, desenvolvida no projeto de extensão
"Chocadeira Automatizada: Tecnologia Social no Fortalecimento da Avicultura Familiar no Semiárido" (IFSertãoPB).

Esta versão contém somente a parte de instrumentação. O gerenciamento de ninhadas, o calendário e os relatórios de
eclosão foram retirados do escopo atual e poderão ser acrescentados depois sem alterar o que existe.

## O que a plataforma faz

| Funcionalidade | Situação |
| --- | --- |
| Cadastro, login, recuperação e alteração de senha, perfil | Implementado e testado |
| Cadastro de chocadeiras e vínculo do ESP32 (identificador gerado pela plataforma) | Implementado e testado |
| Painel geral ao vivo: chocadeiras, equipamentos online, alarmes ativos | Implementado e testado |
| Painel da chocadeira: temperatura, umidade, nível de água e conectividade em tempo real | Implementado e testado |
| Gráficos históricos (1 h, 6 h, 24 h, 7 dias, período personalizado), faixa e períodos em alarme | Implementado e testado |
| Limites de alarme por chocadeira, com faixas de referência (galinha: incubação e eclosão) | Implementado e testado |
| Alarmes: temperatura, umidade, água, falha de sensor, equipamento desconectado | Implementado e testado |
| Central de alarmes com reconhecimento, observação e histórico de 30 dias | Implementado e testado |
| Aviso na tela e notificação do navegador quando surge um alarme | Implementado e testado |
| Serviço de ingestão MQTT e simulador do ESP32 | Implementado e testado |
| Firmware do ESP32 | Pendente: depende da pinagem e do tipo de sensor de nível |
| Notificações por e-mail e push com o site fechado | Próxima etapa |

## Arquitetura

```
ESP32 ──MQTT/TLS──▶ Broker (HiveMQ Cloud) ──▶ Serviço de ingestão (Node.js, sempre ligado)
                                                      │  service_role, funções RPC
                                                      ▼
                       Navegador ◀──Realtime── Supabase (Postgres + Auth + RLS)
                           ▲                          ▲
                           └──────── Next.js (Vercel) ┘
```

- **O equipamento controla, a nuvem supervisiona**: o controle térmico continua no STC-3028; a plataforma observa e alarma.
- A **lógica de alarmes fica no banco** (`public.ingest_reading`): atraso de confirmação configurável, histerese
  (0,2 °C na temperatura, 2 pontos na umidade, 5 pontos na água), registro do pior valor, encerramento automático.
- O **serviço de ingestão** só valida e repassa as mensagens. Ele também verifica a cada 30 s os equipamentos sem
  comunicação. Sessão MQTT persistente: o broker guarda as mensagens enquanto o serviço reinicia.
- O **site** recebe atualizações pelo Supabase Realtime e, como garantia em conexões instáveis, consulta de novo a
  cada 15 s.

## Estrutura

```
chocadeira-ifsertao/
├── apps/
│   ├── web/                   Site Next.js (Vercel)
│   │   └── src/
│   │       ├── app/(app)/     Painel, chocadeiras, limites, dispositivo, alarmes, perfil
│   │       ├── app/(auth)/    Login, cadastro e senha
│   │       └── components/instrumentation/   Indicadores, gráficos (ECharts), alarmes, tempo real
│   └── ingestor/              Serviço de ingestão MQTT e simulador do ESP32
├── packages/shared/           Contrato MQTT, validações (Zod), faixas de referência
├── supabase/
│   ├── migrations/            Banco, funções de ingestão e segurança (RLS)
│   └── tests/                 Testes automatizados do banco
└── docs/adr/                  Registro de decisões
```

## Contrato MQTT (versão 1)

| Tópico | Sentido | QoS | Retido | Conteúdo |
| --- | --- | --- | --- | --- |
| `chocadeira/v1/{device_key}/telemetry` | ESP32 → nuvem | 1 | não | Leitura a cada 30 s |
| `chocadeira/v1/{device_key}/status` | ESP32 → nuvem | 1 | sim | `online` ao conectar; `offline` como Last Will |
| `chocadeira/v1/{device_key}/event` | ESP32 → nuvem | 1 | não | Eventos locais (apenas registrados) |

```json
{
  "v": 1,
  "seq": 1024,
  "ts": "2026-11-13T20:00:00Z",
  "sensors": { "temperature_c": 37.52, "humidity_pct": 55.1, "water_level_pct": 80 },
  "diag": { "rssi": -67, "uptime_s": 86400, "fw": "1.0.0", "mains_power": true, "replay": false }
}
```

Regras: sensor com falha envia `null` (nunca 0); valores fora da faixa física são tratados como falha; `ts` vem do NTP
(relógio incoerente é substituído pelo horário de recebimento); leituras guardadas durante queda de rede são
reenviadas com `"replay": true` e entram no histórico sem gerar alarmes.

## Configuração passo a passo

### 1. Supabase (banco e login)

1. Crie um projeto em <https://supabase.com/dashboard> (região sugerida: São Paulo).
2. No **SQL Editor**, execute, nesta ordem, os arquivos de `supabase/migrations/`:
   `20261109000001_fundacao.sql` e `20261113000001_instrumentacao.sql`.
3. Em **Authentication > URL Configuration**: Site URL `http://localhost:3000` e Redirect URL
   `http://localhost:3000/auth/callback` (depois, os equivalentes do domínio publicado).
4. Em **Project Settings > API**, anote a URL, a *publishable key* (site) e a *service_role key* (somente o serviço
   de ingestão).
5. Recomendado: em **Database > Extensions**, ative `pg_cron` e execute:

   ```sql
   -- Limpeza diária do histórico bruto com mais de 90 dias
   select cron.schedule('limpeza-telemetria', '15 3 * * *', $$select private.purge_old_telemetry(90)$$);
   -- Verificação de comunicação mesmo se o serviço de ingestão parar
   select cron.schedule('verificacao-comunicacao', '* * * * *', $$select public.check_device_timeouts()$$);
   ```

> O envio de e-mails padrão do Supabase é limitado a poucos e-mails por hora. Antes de abrir o cadastro ao público,
> configure um SMTP próprio (por exemplo, Resend). Em desenvolvimento, é possível desativar a confirmação de e-mail.

### 2. Broker MQTT (HiveMQ Cloud Serverless, gratuito)

1. Crie um cluster em <https://console.hivemq.cloud> e anote o endereço (porta 8883, TLS).
2. Crie a credencial do **serviço de ingestão** com permissão de assinar `chocadeira/v1/#`.
3. Para cada ESP32 cadastrado no site, crie uma credencial com usuário igual ao identificador (`chc-...`) e permissão
   de publicar apenas em `chocadeira/v1/{identificador}/#`. A página **Dispositivo** de cada chocadeira mostra esses
   dados.

### 3. Serviço de ingestão

```bash
cp apps/ingestor/.env.example apps/ingestor/.env   # preencha broker e Supabase
npm install
npm run ingestor:build
npm run ingestor:start
```

Ele precisa ficar ligado o tempo todo. Opções: servidor do campus (com `systemd` ou `pm2`), Railway (plano Hobby) ou
um VPS. Na Railway: diretório raiz do repositório, comando de build `npm ci && npm run ingestor:build`, comando de
início `npm run ingestor:start`, variáveis do `.env` cadastradas no painel.

### 4. Site

```bash
cp apps/web/.env.example apps/web/.env.local   # URL, publishable key e endereço do broker
npm run dev
```

Na Vercel: importe o repositório, **Root Directory** `apps/web`, cadastre as variáveis `NEXT_PUBLIC_*` do
`.env.example` e atualize as URLs de redirecionamento no Supabase.

### 5. Testar sem o hardware (simulador)

Cadastre uma chocadeira e um dispositivo no site, crie a credencial do dispositivo no broker e rode:

```bash
# histórico das últimas 24 h (para os gráficos) e depois leituras a cada 30 s
npm run simulate -- --dispositivo chc-xxxxxxxxxxxx --usuario chc-xxxxxxxxxxxx --senha SENHA --historico 24
npm run simulate -- --dispositivo chc-xxxxxxxxxxxx --usuario chc-xxxxxxxxxxxx --senha SENHA

# cenários de alarme: calor, frio, umidade-baixa, agua, falha-sensor, queda (corta a conexão: Last Will)
npm run simulate -- --dispositivo chc-xxxxxxxxxxxx --usuario chc-xxxxxxxxxxxx --senha SENHA --cenario agua --intervalo 5
```

O endereço do broker é lido de `MQTT_URL` no `apps/ingestor/.env` (ou `--url`).

## Comandos

| Comando | Função |
| --- | --- |
| `npm run dev` / `npm run build` | Site em desenvolvimento / compilação de produção |
| `npm run ingestor:dev` | Serviço de ingestão com recarga automática |
| `npm run ingestor:build` / `npm run ingestor:start` | Compila / executa o serviço de ingestão |
| `npm run simulate -- ...` | Simulador do ESP32 |
| `npm run typecheck` | Verificação de tipos de todos os pacotes |
| `npm run test:db` | Migrações em Postgres temporário + testes do banco (requer PostgreSQL 15+ local) |

## Segurança

- O site usa somente a chave pública; todos os dados passam pelo RLS (cada usuário vê apenas a própria organização).
- Usuários não gravam telemetria nem alarmes: só alteram limites, nome do dispositivo e reconhecimento de alarmes.
- As funções de ingestão só são executáveis com a `service_role`, usada apenas pelo serviço de ingestão.
- Cada ESP32 tem credencial própria no broker, restrita aos seus tópicos; a senha não é guardada na plataforma.
- Mensagens são validadas (estrutura, tamanho, faixas físicas, dispositivo cadastrado) antes de chegar ao banco.

## Testes realizados nesta entrega

- **Banco** (`npm run test:db`): 23 verificações, entre elas atraso e histerese dos alarmes, oscilação breve sem
  alarme, pior valor, água sem atraso, falha de sensor, reenvio sem alarme, relógio incoerente, tempo limite de
  comunicação, Last Will, isolamento entre usuários e proteção dos campos exclusivos da ingestão.
- **Ponta a ponta**: Postgres + PostgREST (o mesmo componente de API do Supabase) + broker MQTT + serviço de
  ingestão + simulador + site no navegador: painel com dados reais, atualização automática, gráficos e períodos,
  limites com validação, cadastro de dispositivo, alarme de água com aviso na tela e contador no menu,
  reconhecimento com observação, queda de conexão com Last Will e alarme de equipamento desconectado. Sem erros no
  navegador.
- **Ingestão**: mensagens inválidas (JSON quebrado, versão errada, dispositivo desconhecido, valor fisicamente
  impossível) recusadas ou tratadas como falha de sensor, com registro.

Não testado aqui: o Supabase Realtime (substituído pela consulta a cada 15 s no ambiente de teste), o HiveMQ Cloud
real com TLS e o ESP32 físico.
