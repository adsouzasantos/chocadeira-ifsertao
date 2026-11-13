import "server-only";
import { LIVE_SELECT, toIncubatorLive } from "@/lib/instrumentation";
import { getSession } from "@/lib/session";
import type { Alarm } from "@/lib/types";

/** Chocadeiras com dispositivo e limites, mais os alarmes ativos (respeitando o RLS). */
export async function loadOverview() {
  const { supabase, role } = await getSession();
  const [inc, alarms] = await Promise.all([
    supabase.from("incubators").select(LIVE_SELECT).order("name"),
    supabase.from("alarms").select("*").is("resolved_at", null).order("started_at", { ascending: false }),
  ]);
  if (inc.error) throw new Error(inc.error.message);
  if (alarms.error) throw new Error(alarms.error.message);
  return {
    items: (inc.data ?? []).map((r) => toIncubatorLive(r as Record<string, unknown>)),
    alarms: (alarms.data ?? []) as Alarm[],
    canEdit: role === "owner" || role === "operator",
  };
}
