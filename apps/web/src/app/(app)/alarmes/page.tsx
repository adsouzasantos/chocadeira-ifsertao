import type { Metadata } from "next";
import { AlarmCenter } from "@/components/instrumentation/alarm-center";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";
import type { Alarm } from "@/lib/types";

export const metadata: Metadata = { title: "Alarmes" };

export default async function AlarmesPage() {
  const { supabase, role } = await getSession();
  const since = new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();
  const [active, history, incubators] = await Promise.all([
    supabase.from("alarms").select("*").is("resolved_at", null).order("started_at", { ascending: false }),
    supabase
      .from("alarms")
      .select("*")
      .not("resolved_at", "is", null)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(200),
    supabase.from("incubators").select("id, name"),
  ]);
  if (active.error || history.error) throw new Error("Falha ao carregar alarmes");

  const names = Object.fromEntries((incubators.data ?? []).map((i) => [i.id as string, i.name as string]));

  return (
    <>
      <PageHeader
        title="Central de alarmes"
        description="Ocorrências de todas as chocadeiras. Reconheça o alarme e registre o que foi feito para manter o histórico."
      />
      <AlarmCenter
        active={(active.data ?? []) as Alarm[]}
        history={(history.data ?? []) as Alarm[]}
        names={names}
        canAcknowledge={role === "owner" || role === "operator"}
      />
    </>
  );
}
