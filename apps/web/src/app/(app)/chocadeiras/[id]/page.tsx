import { ArrowLeft, Cpu, History, LineChart, Pencil, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteIncubator } from "@/components/incubators/delete-incubator";
import { AlarmItem } from "@/components/instrumentation/alarm-list";
import { HistoryCharts } from "@/components/instrumentation/history-charts";
import { LivePanel } from "@/components/instrumentation/live-panel";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatTemp, num } from "@/lib/instrumentation";
import { formatDate } from "@/lib/utils";
import { deleteIncubator } from "../actions";
import { getIncubator, getIncubatorAlarms } from "./data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { incubator } = await getIncubator((await params).id);
  return { title: incubator.name };
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-right text-sm text-text">{children}</dd>
    </div>
  );
}

export default async function ChocadeiraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ salvo?: string; limites?: string }>;
}) {
  const { id } = await params;
  const { salvo, limites } = await searchParams;
  const [{ incubator, role, canEdit }, alarms] = await Promise.all([getIncubator(id), getIncubatorAlarms(id)]);
  const s = incubator.settings;
  // A data/hora "agora" é fixada na renderização do servidor; o painel ao vivo atualiza no navegador
  const renderedAt = Date.now();

  return (
    <>
      <Link href="/chocadeiras" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-link hover:underline">
        <ArrowLeft aria-hidden className="size-4" />
        Chocadeiras
      </Link>

      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="rounded bg-cream-200 px-1.5 py-px font-mono text-xs text-ink-700">{incubator.code}</span>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{incubator.name}</h1>
          {incubator.model && <p className="mt-0.5 text-sm text-text-muted">{incubator.model}</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`/chocadeiras/${id}/limites`} variant="secondary" size="sm">
              <SlidersHorizontal aria-hidden className="size-4" />
              Limites de alarme
            </ButtonLink>
            <ButtonLink href={`/chocadeiras/${id}/dispositivo`} variant="secondary" size="sm">
              <Cpu aria-hidden className="size-4" />
              Dispositivo
            </ButtonLink>
            <ButtonLink href={`/chocadeiras/${id}/editar`} variant="secondary" size="sm">
              <Pencil aria-hidden className="size-4" />
              Editar
            </ButtonLink>
          </div>
        )}
      </div>

      {(salvo || limites) && (
        <div className="mb-4">
          <Alert tone="success">{limites ? "Limites de alarme atualizados." : "Dados da chocadeira salvos."}</Alert>
        </div>
      )}

      <LivePanel initial={incubator} initialAlarms={alarms.active} canEdit={canEdit} />

      {incubator.device && (
        <Card className="mt-6">
          <CardHeader
            icon={<LineChart aria-hidden className="size-5" />}
            title="Histórico"
            description="Médias por intervalo. Os gráficos compartilham a linha de leitura para comparar as variáveis no mesmo instante."
          />
          <HistoryCharts incubatorId={incubator.id} settings={s} />
        </Card>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader icon={<History aria-hidden className="size-5" />} title="Alarmes encerrados recentemente" />
          <CardBody>
            {alarms.recent.length === 0 ? (
              <p className="text-sm text-text-muted">Nenhum alarme encerrado.</p>
            ) : (
              <ul className="space-y-2">
                {alarms.recent.map((a) => (
                  <AlarmItem key={a.id} alarm={a} now={renderedAt} canAcknowledge={canEdit} />
                ))}
              </ul>
            )}
            <Link href="/alarmes" className="mt-3 inline-block text-sm font-medium text-link hover:underline">
              Ver central de alarmes
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Equipamento e limites" />
          <CardBody className="py-1">
            <dl className="divide-y divide-border">
              <Info label="Capacidade">{incubator.egg_capacity ? `${incubator.egg_capacity} ovos` : "Não informada"}</Info>
              <Info label="Cadastrada em">{formatDate(incubator.created_at)}</Info>
              {s && (
                <>
                  <Info label="Temperatura">
                    {formatTemp(s.temp_min_c)} a {formatTemp(s.temp_max_c)} °C
                  </Info>
                  <Info label="Umidade">
                    {num(s.humidity_min_pct)} a {num(s.humidity_max_pct)}%
                  </Info>
                  <Info label="Água mínima">{s.water_min_pct}%</Info>
                  <Info label="Confirmação do alarme">{s.alarm_delay_s} s</Info>
                  <Info label="Tolerância sem comunicação">{s.offline_timeout_s} s</Info>
                </>
              )}
              {incubator.description && (
                <Info label="Descrição">
                  <span className="whitespace-pre-line">{incubator.description}</span>
                </Info>
              )}
            </dl>
          </CardBody>
        </Card>
      </div>

      {role === "owner" && (
        <div className="mt-8 border-t border-border pt-6">
          <DeleteIncubator name={incubator.name} action={deleteIncubator.bind(null, incubator.id)} />
        </div>
      )}
    </>
  );
}
