import "server-only";
import { notFound } from "next/navigation";
import { LIVE_SELECT, toIncubatorLive } from "@/lib/instrumentation";
import { getSession } from "@/lib/session";
import type { Alarm } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chocadeira com dispositivo e limites; inexistente ou de outra conta resulta em 404. */
export async function getIncubator(id: string) {
  if (!UUID.test(id)) notFound();
  const { supabase, role } = await getSession();
  const { data, error } = await supabase.from("incubators").select(LIVE_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound();
  return {
    incubator: toIncubatorLive(data as Record<string, unknown>),
    role,
    canEdit: role === "owner" || role === "operator",
  };
}

/** Alarmes da chocadeira: ativos e os últimos encerrados. */
export async function getIncubatorAlarms(id: string) {
  const { supabase } = await getSession();
  const [active, recent] = await Promise.all([
    supabase.from("alarms").select("*").eq("incubator_id", id).is("resolved_at", null).order("started_at", { ascending: false }),
    supabase
      .from("alarms")
      .select("*")
      .eq("incubator_id", id)
      .not("resolved_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(10),
  ]);
  return { active: (active.data ?? []) as Alarm[], recent: (recent.data ?? []) as Alarm[] };
}
