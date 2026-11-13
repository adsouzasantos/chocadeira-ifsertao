"use client";

import { Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialFormState, type FormState } from "@/lib/types";

/** Exclusão em duas etapas, para evitar remoções acidentais. */
export function DeleteIncubator({
  name,
  action,
}: {
  name: string;
  action: (prev: FormState) => Promise<FormState>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(action, initialFormState);

  if (!confirming) {
    return (
      <Button variant="ghost" className="text-alert-700 hover:bg-alert-50" onClick={() => setConfirming(true)}>
        <Trash2 aria-hidden className="size-4.5" />
        Excluir chocadeira
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-alert-100 bg-alert-50 p-4">
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <p className="text-sm text-alert-800">
        Excluir <strong>{name}</strong>? Esta ação não pode ser desfeita.
      </p>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant="danger" size="sm" pendingText="Excluindo…">
          Confirmar exclusão
        </SubmitButton>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
