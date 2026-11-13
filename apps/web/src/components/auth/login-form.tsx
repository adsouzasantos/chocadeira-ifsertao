"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/types";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initialFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {state.message && <Alert tone="error">{state.message}</Alert>}

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

      <Field id="password" label="Senha" error={e.password}>
        <PasswordInput id="password" name="password" autoComplete="current-password" required invalid={!!e.password} />
      </Field>

      <div className="flex justify-end">
        <Link href="/recuperar-senha" className="text-sm font-medium text-link underline-offset-4 hover:underline">
          Esqueci minha senha
        </Link>
      </div>

      <SubmitButton className="w-full" pendingText="Entrando…">
        Entrar
      </SubmitButton>
    </form>
  );
}
