"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/types";

/** Usado na redefinição por e-mail e na alteração de senha do perfil. */
export function NewPasswordForm({ showContinue = false }: { showContinue?: boolean }) {
  const [state, action] = useActionState(updatePassword, initialFormState);
  const e = state.fieldErrors ?? {};

  if (state.ok && showContinue) {
    return (
      <div className="space-y-4">
        <Alert tone="success">{state.message}</Alert>
        <ButtonLink href="/painel" className="w-full">
          Ir para o painel
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Field id="password" label="Nova senha" error={e.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required invalid={!!e.password} />
      </Field>
      <Field id="confirmPassword" label="Confirme a nova senha" error={e.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          invalid={!!e.confirmPassword}
        />
      </Field>
      <SubmitButton pendingText="Salvando…" className={showContinue ? "w-full" : undefined}>
        Salvar nova senha
      </SubmitButton>
    </form>
  );
}
