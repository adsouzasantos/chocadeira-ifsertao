"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/types";

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  const e = state.fieldErrors ?? {};

  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field id="email" label="E-mail da conta" error={e.email}>
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
      <SubmitButton className="w-full" pendingText="Enviando…">
        Enviar link de recuperação
      </SubmitButton>
    </form>
  );
}
