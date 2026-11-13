"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/(app)/perfil/actions";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState } from "@/lib/types";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfile, initialFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Field id="fullName" label="Nome completo" error={e.fullName}>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={state.values?.fullName ?? fullName}
          invalid={!!e.fullName}
        />
      </Field>
      <Field id="email" label="E-mail" hint="O e-mail é usado para entrar e para a recuperação de senha.">
        <Input id="email" value={email} readOnly disabled />
      </Field>
      <SubmitButton>Salvar perfil</SubmitButton>
    </form>
  );
}
