"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState, type Incubator } from "@/lib/types";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function IncubatorForm({
  action,
  incubator,
  cancelHref,
  submitLabel,
}: {
  action: Action;
  incubator?: Incubator;
  cancelHref: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.fieldErrors ?? {};
  // Após um erro, mantém o que o usuário digitou; senão, mostra os dados salvos
  const v = state.values ?? {
    name: incubator?.name ?? "",
    code: incubator?.code ?? "",
    model: incubator?.model ?? "",
    eggCapacity: incubator?.egg_capacity?.toString() ?? "",
    description: incubator?.description ?? "",
  };

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field id="name" label="Nome" error={e.name} hint="Como você chama esta chocadeira. Ex.: Chocadeira do galpão.">
          <Input id="name" name="name" required maxLength={80} defaultValue={v.name} invalid={!!e.name} />
        </Field>
        <Field id="code" label="Identificação" error={e.code} hint="Código curto e único. Ex.: CHOC-01.">
          <Input
            id="code"
            name="code"
            required
            maxLength={32}
            autoCapitalize="characters"
            defaultValue={v.code}
            invalid={!!e.code}
            className="uppercase"
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field id="model" label="Modelo ou tipo" optional error={e.model} hint="Ex.: comercial adaptada, artesanal.">
          <Input id="model" name="model" maxLength={80} defaultValue={v.model} invalid={!!e.model} />
        </Field>
        <Field id="eggCapacity" label="Capacidade (ovos)" optional error={e.eggCapacity}>
          <Input
            id="eggCapacity"
            name="eggCapacity"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            step={1}
            defaultValue={v.eggCapacity}
            invalid={!!e.eggCapacity}
          />
        </Field>
      </div>

      <Field id="description" label="Descrição" optional error={e.description}>
        <Textarea
          id="description"
          name="description"
          maxLength={1000}
          rows={4}
          defaultValue={v.description}
          invalid={!!e.description}
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
