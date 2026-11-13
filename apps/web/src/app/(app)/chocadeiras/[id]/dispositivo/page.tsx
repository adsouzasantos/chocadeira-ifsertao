import { topics } from "@chocadeira/shared";
import { ArrowLeft, Cpu, KeyRound, Radio } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyValue, RegisterDeviceForm, RemoveDeviceForm } from "@/components/instrumentation/device-forms";
import { Alert } from "@/components/ui/alert";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateTime } from "@/lib/instrumentation";
import { registerDevice, removeDevice } from "../../instrument-actions";
import { getIncubator } from "../data";

export const metadata: Metadata = { title: "Dispositivo" };

const SAMPLE = `{
  "v": 1,
  "seq": 1024,
  "ts": "2026-11-13T20:00:00Z",
  "sensors": {
    "temperature_c": 37.52,
    "humidity_pct": 55.1,
    "water_level_pct": 80
  },
  "diag": { "rssi": -67, "uptime_s": 86400, "fw": "1.0.0", "mains_power": true }
}`;

export default async function DispositivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ novo?: string; removido?: string }>;
}) {
  const { id } = await params;
  const { novo, removido } = await searchParams;
  const { incubator, canEdit } = await getIncubator(id);
  if (!canEdit) notFound();
  const device = incubator.device;
  const broker = process.env.NEXT_PUBLIC_MQTT_HOST;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/chocadeiras/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        {incubator.name}
      </Link>
      <PageHeader
        title="Dispositivo de instrumentação"
        description="O ESP32 envia as leituras ao broker MQTT, que as entrega à plataforma."
      />

      {removido && (
        <div className="mb-4">
          <Alert tone="success">Dispositivo removido. O histórico da chocadeira foi mantido.</Alert>
        </div>
      )}

      {!device ? (
        <Card>
          <CardHeader icon={<Cpu aria-hidden className="size-5" />} title="Cadastrar ESP32" />
          <CardBody className="py-5">
            <p className="mb-4 text-sm text-text-muted">
              A plataforma gera um identificador único para o dispositivo. Ele será usado na configuração do ESP32 e
              do broker.
            </p>
            <RegisterDeviceForm action={registerDevice.bind(null, id)} />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-5">
          {novo && <Alert tone="success">Dispositivo cadastrado. Siga os passos abaixo para configurar o ESP32.</Alert>}

          <Card>
            <CardHeader icon={<Cpu aria-hidden className="size-5" />} title={device.label ?? "ESP32"} />
            <CardBody className="space-y-4">
              <div>
                <p className="mb-1.5 text-sm font-medium">Identificador do dispositivo (DEVICE_KEY)</p>
                <CopyValue value={device.device_key} label="identificador" />
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-text-muted">Cadastrado em</dt>
                  <dd>{formatDateTime(device.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Última comunicação</dt>
                  <dd>{device.last_seen_at ? formatDateTime(device.last_seen_at) : "Nenhuma ainda"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Firmware</dt>
                  <dd>{device.firmware_version ?? "Não informado"}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<KeyRound aria-hidden className="size-5" />} title="1. Criar a credencial no broker" />
            <CardBody className="space-y-3 text-sm">
              <p>
                No painel do broker MQTT{broker ? ` (${broker})` : ""}, crie uma credencial exclusiva para este
                dispositivo:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  Usuário: <code className="rounded bg-cream-200 px-1">{device.device_key}</code>
                </li>
                <li>Senha: gere uma senha forte e guarde-a apenas no firmware do ESP32.</li>
                <li>
                  Permissão: publicar somente em{" "}
                  <code className="rounded bg-cream-200 px-1">chocadeira/v1/{device.device_key}/#</code>
                </li>
              </ul>
              <p className="text-text-muted">
                A senha do dispositivo não é registrada na plataforma, para que um vazamento do banco não exponha o
                acesso ao broker.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Radio aria-hidden className="size-5" />} title="2. Configurar o ESP32" />
            <CardBody className="space-y-4 text-sm">
              <p>Use conexão TLS (porta 8883) e publique nos tópicos abaixo, sempre com QoS 1:</p>
              <dl className="space-y-3">
                <div>
                  <dt className="mb-1 font-medium">Leituras (a cada 30 s)</dt>
                  <dd>
                    <CopyValue value={topics.telemetry(device.device_key)} label="tópico de leituras" />
                  </dd>
                </div>
                <div>
                  <dt className="mb-1 font-medium">
                    Status (mensagem retida; Last Will com <code>offline</code>)
                  </dt>
                  <dd>
                    <CopyValue value={topics.status(device.device_key)} label="tópico de status" />
                  </dd>
                </div>
              </dl>
              <div>
                <p className="mb-1 font-medium">Formato da mensagem de leitura</p>
                <pre className="overflow-x-auto rounded-lg bg-ink-900 p-4 font-mono text-xs leading-relaxed text-cream-100">
                  {SAMPLE}
                </pre>
                <p className="mt-2 text-text-muted">
                  Envie <code>null</code> quando um sensor falhar (nunca 0). O horário <code>ts</code> deve vir do NTP; se o
                  relógio estiver incorreto, a plataforma usa o horário de recebimento.
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="border-t border-border pt-5">
            <RemoveDeviceForm action={removeDevice.bind(null, id, device.id)} />
          </div>
        </div>
      )}
    </div>
  );
}
