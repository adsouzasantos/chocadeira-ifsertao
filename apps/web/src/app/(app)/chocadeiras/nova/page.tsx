import type { Metadata } from "next";
import { IncubatorForm } from "@/components/incubators/incubator-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createIncubator } from "../actions";

export const metadata: Metadata = { title: "Nova chocadeira" };

export default function NovaChocadeiraPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nova chocadeira"
        description="Informe os dados do equipamento. O dispositivo de instrumentação poderá ser vinculado depois."
      />
      <Card>
        <CardBody className="py-6">
          <IncubatorForm action={createIncubator} cancelHref="/chocadeiras" submitLabel="Cadastrar chocadeira" />
        </CardBody>
      </Card>
    </div>
  );
}
