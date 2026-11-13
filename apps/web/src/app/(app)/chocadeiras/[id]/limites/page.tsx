import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlarmSettingsForm } from "@/components/instrumentation/alarm-settings-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateAlarmSettings } from "../../instrument-actions";
import { getIncubator } from "../data";

export const metadata: Metadata = { title: "Limites de alarme" };

export default async function LimitesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { incubator, canEdit } = await getIncubator(id);
  if (!canEdit || !incubator.settings) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Limites de alarme"
        description={`${incubator.name}: defina as faixas conforme a espécie e a fase da incubação.`}
      />
      <Card>
        <CardBody className="py-6">
          <AlarmSettingsForm
            action={updateAlarmSettings.bind(null, id)}
            settings={incubator.settings}
            cancelHref={`/chocadeiras/${id}`}
          />
        </CardBody>
      </Card>
    </div>
  );
}
