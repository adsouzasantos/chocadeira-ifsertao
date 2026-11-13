import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "block w-full rounded-lg border bg-white px-3 text-[0.9375rem] text-text placeholder:text-ink-400 " +
  "transition-colors focus:border-brand-500 focus:outline-none focus:ring-3 focus:ring-brand-500/25 " +
  "disabled:bg-cream-200";

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}

/** Rótulo, dica e mensagem de erro ligados ao campo para leitores de tela. */
export function Field({ id, label, error, hint, optional, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-medium text-text">
        {label}
        {optional && <span className="text-xs font-normal text-text-muted">opcional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-alarm-critical-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends ComponentProps<"input"> {
  invalid?: boolean;
}

export function Input({ className, invalid, id, ...props }: InputProps) {
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
      className={cn(control, "h-11", invalid ? "border-alert-500" : "border-border-strong", className)}
      {...props}
    />
  );
}

interface TextareaProps extends ComponentProps<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, id, ...props }: TextareaProps) {
  return (
    <textarea
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${id}-error` : `${id}-hint`}
      className={cn(control, "min-h-24 py-2.5", invalid ? "border-alert-500" : "border-border-strong", className)}
      {...props}
    />
  );
}
