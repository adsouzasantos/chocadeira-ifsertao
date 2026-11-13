import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { LiveOverview } from "@/components/instrumentation/live-overview";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { loadOverview } from "@/lib/instrumentation-data";

export const metadata: Metadata = { title: "Chocadeiras" };

export default async function ChocadeirasPage({ searchParams }: { searchParams: Promise<{ excluida?: string }> }) {
  const { excluida } = await searchParams;
  const { items, alarms, canEdit } = await loadOverview();

  return (
    <>
      <PageHeader
        title="Chocadeiras"
        description="Cada chocadeira tem seu próprio painel de instrumentação, histórico e limites de alarme."
        actions={
          canEdit &&
          items.length > 0 && (
            <ButtonLink href="/chocadeiras/nova">
              <Plus aria-hidden className="size-5" />
              Nova chocadeira
            </ButtonLink>
          )
        }
      />
      {excluida && (
        <div className="mb-4">
          <Alert tone="success">Chocadeira excluída.</Alert>
        </div>
      )}
      <LiveOverview initial={items} initialAlarms={alarms} showKpis={false} showAlarms={false} canAcknowledge={canEdit} />
    </>
  );
}
