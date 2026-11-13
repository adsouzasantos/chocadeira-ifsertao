"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LIVE_SELECT, toIncubatorLive } from "@/lib/instrumentation";
import { createClient } from "@/lib/supabase/client";
import type { Alarm, IncubatorLive } from "@/lib/types";

const POLL_MS = 15_000;

/**
 * Mantém chocadeiras, dispositivos e alarmes ativos atualizados sem recarregar
 * a página: assina o Supabase Realtime e, como garantia (conexões instáveis no
 * campo), consulta novamente a cada 15 s.
 */
export function useLiveIncubators(
  initial: IncubatorLive[],
  initialAlarms: Alarm[],
  options: { incubatorId?: string } = {},
) {
  const { incubatorId } = options;
  const [items, setItems] = useState(initial);
  const [alarms, setAlarms] = useState(initialAlarms);
  const [now, setNow] = useState(() => Date.now());
  const [realtime, setRealtime] = useState(false);
  const [lastSync, setLastSync] = useState(() => Date.now());
  const busy = useRef(false);

  const refetch = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const supabase = createClient();
      let incQuery = supabase.from("incubators").select(LIVE_SELECT).order("name");
      let alarmQuery = supabase.from("alarms").select("*").is("resolved_at", null).order("started_at", { ascending: false });
      if (incubatorId) {
        incQuery = incQuery.eq("id", incubatorId);
        alarmQuery = alarmQuery.eq("incubator_id", incubatorId);
      }
      const [inc, al] = await Promise.all([incQuery, alarmQuery]);
      if (!inc.error && inc.data) setItems(inc.data.map((r) => toIncubatorLive(r as Record<string, unknown>)));
      if (!al.error && al.data) setAlarms(al.data as Alarm[]);
      if (!inc.error && !al.error) setLastSync(Date.now());
    } finally {
      busy.current = false;
    }
  }, [incubatorId]);

  useEffect(() => {
    const poll = setInterval(() => void refetch(), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 5_000);
    const onFocus = () => void refetch();
    window.addEventListener("focus", onFocus);

    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refetch(), 300);
    };
    const channel = supabase
      .channel(`instrumentacao-${incubatorId ?? "geral"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "alarms" }, schedule)
      .subscribe((status) => setRealtime(status === "SUBSCRIBED"));

    return () => {
      clearInterval(poll);
      clearInterval(clock);
      clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [refetch, incubatorId]);

  return { items, alarms, now, realtime, lastSync, refetch };
}
