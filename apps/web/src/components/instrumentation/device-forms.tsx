"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/types";

export function RegisterDeviceForm({ action }: { action: (p: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field id="label" label="Nome do dispositivo" optional hint="Ex.: ESP32 da chocadeira do galpão.">
        <Input id="label" name="label" maxLength={80} />
      </Field>
      <SubmitButton pendingText="Cadastrando…">Cadastrar dispositivo</SubmitButton>
    </form>
  );
}

export function RemoveDeviceForm({ action }: { action: (p: FormState) => Promise<FormState> }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-alert-700 hover:bg-alert-50" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden className="size-4.5" />
        Remover dispositivo
      </Button>
    );
  }
  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-alert-100 bg-alert-50 p-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <p className="text-sm text-alert-800">
        O ESP32 deixará de ser aceito pela plataforma. O histórico de leituras e alarmes da chocadeira será mantido.
        Lembre-se de excluir também a credencial dele no broker MQTT.
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" size="sm" pendingText="Removendo…">
          Confirmar remoção
        </SubmitButton>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-white py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink-900">{value}</code>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Copiar ${label}`}
        onClick={async () => {
          await navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
