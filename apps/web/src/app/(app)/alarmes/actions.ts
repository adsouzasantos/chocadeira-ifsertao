"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/types";

/** Registra o reconhecimento do alarme e uma observação opcional sobre a resolução. */
export async function acknowledgeAlarm(alarmId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("note");
  const note = typeof raw === "string" ? raw.trim().slice(0, 500) : "";
  const { supabase } = await getSession();
  const { error } = await supabase.rpc("acknowledge_alarm", { p_alarm_id: alarmId, p_note: note || null });
  if (error) {
    return {
      ok: false,
      message: error.code === "42501" ? "Você não tem permissão para reconhecer este alarme." : "Não foi possível registrar. Tente novamente.",
    };
  }
  revalidatePath("/alarmes");
  revalidatePath("/painel");
  return { ok: true, message: "Alarme reconhecido." };
}
