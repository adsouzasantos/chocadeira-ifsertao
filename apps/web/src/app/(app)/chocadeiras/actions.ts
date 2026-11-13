"use server";

import { fieldErrorsFrom, incubatorInputSchema } from "@chocadeira/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import type { FormState } from "@/lib/types";

const FIELDS = ["name", "code", "model", "eggCapacity", "description"] as const;

function readForm(formData: FormData) {
  const values: Record<string, string> = {};
  for (const key of FIELDS) {
    const v = formData.get(key);
    values[key] = typeof v === "string" ? v : "";
  }
  return values;
}

function dbErrorMessage(error: { code?: string }) {
  if (error.code === "23505") return { fieldErrors: { code: "Já existe uma chocadeira com esta identificação." } };
  if (error.code === "42501") return { message: "Você não tem permissão para esta operação." };
  return { message: "Não foi possível salvar. Tente novamente em instantes." };
}

export async function createIncubator(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData);
  const parsed = incubatorInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const { supabase, organizationId } = await getSession();
  if (!organizationId) return { ok: false, message: "Sua conta não está vinculada a uma organização.", values };

  const { data, error } = await supabase
    .from("incubators")
    .insert({
      organization_id: organizationId,
      name: parsed.data.name,
      code: parsed.data.code,
      model: parsed.data.model,
      egg_capacity: parsed.data.eggCapacity,
      description: parsed.data.description,
    })
    .select("id")
    .single();

  if (error) return { ok: false, ...dbErrorMessage(error), values };

  revalidatePath("/chocadeiras");
  revalidatePath("/painel");
  redirect(`/chocadeiras/${data.id}?salvo=1`);
}

export async function updateIncubator(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const values = readForm(formData);
  const parsed = incubatorInputSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const { supabase } = await getSession();
  // O RLS garante que só membros com permissão alterem a chocadeira
  const { data, error } = await supabase
    .from("incubators")
    .update({
      name: parsed.data.name,
      code: parsed.data.code,
      model: parsed.data.model,
      egg_capacity: parsed.data.eggCapacity,
      description: parsed.data.description,
    })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, ...dbErrorMessage(error), values };
  if (!data?.length) return { ok: false, message: "Chocadeira não encontrada ou sem permissão de edição.", values };

  revalidatePath("/chocadeiras");
  revalidatePath(`/chocadeiras/${id}`);
  revalidatePath("/painel");
  redirect(`/chocadeiras/${id}?salvo=1`);
}

export async function deleteIncubator(id: string, _prev: FormState): Promise<FormState> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("incubators").delete().eq("id", id).select("id");

  if (error) return { ok: false, ...dbErrorMessage(error) };
  if (!data?.length) return { ok: false, message: "Somente o proprietário pode excluir esta chocadeira." };

  revalidatePath("/chocadeiras");
  revalidatePath("/painel");
  redirect("/chocadeiras?excluida=1");
}
