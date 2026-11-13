# Registro de decisões arquiteturais

Documento completo da Etapa 1: Plataforma de Chocadeiras IFSertãoPB, Registro de Arquitetura e Decisões
(https://claude.ai/artifact/P1NPtVAkQcudDcPDAJAzse).

| ADR | Decisão | Situação |
| --- | --- | --- |
| 001 | Arquitetura híbrida: Vercel para o site, serviço de ingestão Node.js permanente para MQTT | Adotada |
| 002 | Supabase para banco, autenticação e tempo real | Adotada |
| 003 | Next.js, TypeScript e Tailwind CSS no site | Adotada |
| 004 | Apache ECharts para gráficos (importação modular); um gráfico por variável, sem eixo duplo | Adotada |
| 005 | Postgres com agregação por intervalo (`date_bin`) e retenção de 90 dias do dado bruto, sem TimescaleDB | Adotada |
| 006 | HiveMQ Cloud Serverless no piloto; Mosquitto em VPS se for necessário | Adotada no piloto |
| 007 | Tópicos `chocadeira/v1/{device_key}/...` e mensagem JSON versão 1 | Adotada |
| 008 | Google Calendar em dois níveis | Fora do escopo atual |
| 009 | Design tokens com tons derivados para atender ao contraste WCAG | Adotada |
| 010 | Organização pessoal criada no cadastro; dados vinculados à organização | Adotada |
| 011 | Componentes de interface próprios (padrão shadcn/ui) | Adotada |
| 012 | Escopo reduzido à instrumentação (ninhadas, calendário e relatórios adiados) | Adotada em 13/11/2026 |
| 013 | Lógica de alarmes no banco (função `ingest_reading`), com atraso de confirmação e histerese | Adotada |
| 014 | `device_key` gerado pela plataforma; credencial MQTT por dispositivo, senha fora do banco | Adotada |
| 015 | Tempo real pelo Supabase Realtime com consulta de garantia a cada 15 s | Adotada |
| 016 | Cores das séries validadas: temperatura #018D3E, umidade #1D6FA5, água #B2650A | Adotada |

## Histórico de etapas

| Data | Etapa |
| --- | --- |
| 13/11/2026 | Instrumentação: dispositivos, ingestão MQTT, painéis ao vivo, gráficos, limites e alarmes |
| 09/11/2026 | Fases 0 e 1: estrutura do projeto, banco com RLS, autenticação e chocadeiras |
| 09/11/2026 | Etapa 1: análise e proposta de arquitetura |
