"use server";

import { fieldErrorsFrom, profileSchema } from "@chocadeira/shared";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/types";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = formData.get("fullName");
  const values = { fullName: typeof fullName === "string" ? fullName : "" };
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const { supabase, user } = await getSession();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", user.id);
  if (error) return { ok: false, message: "Não foi possível salvar o perfil. Tente novamente.", values };

  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil atualizado.", values: { fullName: parsed.data.fullName } };
}
