"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { ComponentProps } from "react";

/** Botão de envio que se desabilita e mostra progresso enquanto o formulário é processado. */
export function SubmitButton({
  children,
  pendingText = "Salvando…",
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
      {pending ? pendingText : children}
    </Button>
  );
}
