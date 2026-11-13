import { Plus } from "lucide-react";
import type { Metadata } from "next";
import { LiveOverview } from "@/components/instrumentation/live-overview";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { loadOverview } from "@/lib/instrumentation-data";
import { getSession } from "@/lib/session";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = { title: "Painel" };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Fortaleza" }).format(new Date()),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function PainelPage() {
  const { profile } = await getSession();
  const { items, alarms, canEdit } = await loadOverview();
  const name = firstName(profile?.full_name);

  return (
    <>
      <PageHeader
        title={name ? `${greeting()}, ${name}` : greeting()}
        description="Situação atual das suas chocadeiras."
        actions={
          canEdit && (
            <ButtonLink href="/chocadeiras/nova" variant="secondary">
              <Plus aria-hidden className="size-5" />
              Nova chocadeira
            </ButtonLink>
          )
        }
      />
      <LiveOverview initial={items} initialAlarms={alarms} canAcknowledge={canEdit} />
    </>
  );
}
