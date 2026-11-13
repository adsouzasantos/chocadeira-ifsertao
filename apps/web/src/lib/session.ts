import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Profile } from "@/lib/types";

/**
 * Usuário logado, perfil e organização ativa. Memorizado por requisição
 * para que layout e página não repitam as consultas.
 */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  // Nesta fase cada usuário atua na sua organização pessoal (a primeira criada)
  const membership = (memberships ?? [])[0] as { organization_id: string; role: OrgRole } | undefined;

  return {
    supabase,
    user,
    profile: (profile as Profile | null) ?? null,
    organizationId: membership?.organization_id ?? null,
    role: membership?.role ?? null,
  };
});
