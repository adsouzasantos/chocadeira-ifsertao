"use client";

import { useActionState } from "react";
import { signUp } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/types";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, initialFormState);
  const e = state.fieldErrors ?? {};

  if (state.ok) {
    return (
      <Alert tone="success">
        <strong className="block font-semibold">Cadastro realizado.</strong>
        {state.message}
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <Field id="fullName" label="Nome completo" error={e.fullName}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          defaultValue={state.values?.fullName}
          invalid={!!e.fullName}
        />
      </Field>

      <Field id="email" label="E-mail" error={e.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          invalid={!!e.email}
        />
      </Field>

      <Field id="password" label="Senha" error={e.password} hint="Mínimo de 8 caracteres, com letras e números.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required invalid={!!e.password} />
      </Field>

      <Field id="confirmPassword" label="Confirme a senha" error={e.confirmPassword}>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
          invalid={!!e.confirmPassword}
        />
      </Field>

      <div className="space-y-1.5">
        <label className="flex items-start gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 size-4.5 shrink-0 accent-brand-700"
            aria-invalid={!!e.acceptTerms || undefined}
          />
          <span>
            Li e aceito os termos de uso e a política de privacidade, conforme a Lei Geral de Proteção de Dados (LGPD).
          </span>
        </label>
        {e.acceptTerms && (
          <p className="text-sm text-alarm-critical-text" role="alert">
            {e.acceptTerms}
          </p>
        )}
      </div>

      <SubmitButton className="w-full" pendingText="Criando conta…">
        Criar conta
      </SubmitButton>
    </form>
  );
}
