"use server";

import { alarmSettingsSchema, fieldErrorsFrom } from "@chocadeira/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/types";

/** Cadastra o dispositivo da chocadeira; o identificador é gerado pelo banco. */
export async function registerDevice(incubatorId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formData.get("label");
  const label = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 80) : null;
  const { supabase, organizationId } = await getSession();
  if (!organizationId) return { ok: false, message: "Sua conta não está vinculada a uma organização." };

  const { error } = await supabase
    .from("devices")
    .insert({ organization_id: organizationId, incubator_id: incubatorId, label });

  if (error) {
    if (error.code === "23505") return { ok: false, message: "Esta chocadeira já possui um dispositivo." };
    if (error.code === "42501") return { ok: false, message: "Você não tem permissão para cadastrar dispositivos." };
    return { ok: false, message: "Não foi possível cadastrar o dispositivo. Tente novamente." };
  }
  revalidatePath(`/chocadeiras/${incubatorId}`, "layout");
  redirect(`/chocadeiras/${incubatorId}/dispositivo?novo=1`);
}

/** Remove o dispositivo. O histórico de leituras e alarmes da chocadeira é mantido. */
export async function removeDevice(incubatorId: string, deviceId: string, _prev: FormState): Promise<FormState> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("devices").delete().eq("id", deviceId).select("id");
  if (error || !data?.length) return { ok: false, message: "Não foi possível remover o dispositivo." };
  revalidatePath(`/chocadeiras/${incubatorId}`, "layout");
  redirect(`/chocadeiras/${incubatorId}/dispositivo?removido=1`);
}

const SETTINGS_FIELDS = [
  "tempMinC",
  "tempMaxC",
  "humidityMinPct",
  "humidityMaxPct",
  "waterMinPct",
  "alarmDelayS",
  "offlineTimeoutS",
  "preset",
] as const;

export async function updateAlarmSettings(incubatorId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const k of SETTINGS_FIELDS) {
    const v = formData.get(k);
    // Aceita vírgula decimal, como é digitado no Brasil
    values[k] = typeof v === "string" ? v.trim().replace(",", ".") : "";
  }
  const parsed = alarmSettingsSchema.safeParse({ ...values, preset: values.preset || null });
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const d = parsed.data;
  const { supabase } = await getSession();
  const { data, error } = await supabase
    .from("alarm_settings")
    .update({
      temp_min_c: d.tempMinC,
      temp_max_c: d.tempMaxC,
      humidity_min_pct: d.humidityMinPct,
      humidity_max_pct: d.humidityMaxPct,
      water_min_pct: d.waterMinPct,
      alarm_delay_s: d.alarmDelayS,
      offline_timeout_s: d.offlineTimeoutS,
      preset: d.preset ?? null,
    })
    .eq("incubator_id", incubatorId)
    .select("incubator_id");

  if (error) return { ok: false, message: "Não foi possível salvar os limites. Confira os valores e tente novamente.", values };
  if (!data?.length) return { ok: false, message: "Você não tem permissão para alterar estes limites.", values };

  revalidatePath(`/chocadeiras/${incubatorId}`, "layout");
  redirect(`/chocadeiras/${incubatorId}?limites=1`);
}
