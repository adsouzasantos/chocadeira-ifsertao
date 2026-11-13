import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IncubatorForm } from "@/components/incubators/incubator-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { updateIncubator } from "../../actions";
import { getIncubator } from "../data";

export const metadata: Metadata = { title: "Editar chocadeira" };

export default async function EditarChocadeiraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { incubator, role } = await getIncubator(id);
  if (role !== "owner" && role !== "operator") notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar chocadeira" description={incubator.name} />
      <Card>
        <CardBody className="py-6">
          <IncubatorForm
            action={updateIncubator.bind(null, incubator.id)}
            incubator={incubator}
            cancelHref={`/chocadeiras/${incubator.id}`}
            submitLabel="Salvar alterações"
          />
        </CardBody>
      </Card>
    </div>
  );
}
