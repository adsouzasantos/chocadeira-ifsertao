import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nova senha" };

/** Aberta pelo link de recuperação: o callback já criou a sessão temporária. */
export default async function RedefinirSenhaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      {user ? (
        <>
          <p className="mt-1 mb-6 text-[0.9375rem] text-text-muted">Defina a nova senha da conta {user.email}.</p>
          <NewPasswordForm showContinue />
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <Alert tone="error">O link de recuperação é inválido ou expirou.</Alert>
          <ButtonLink href="/recuperar-senha" variant="secondary" className="w-full">
            Solicitar novo link
          </ButtonLink>
        </div>
      )}
    </>
  );
}
