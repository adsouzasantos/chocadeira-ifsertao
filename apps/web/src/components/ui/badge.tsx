import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-cream-200 text-ink-700 border-cream-400",
  success: "bg-brand-50 text-brand-800 border-brand-200",
  warning: "bg-warning-50 text-warning-700 border-warning-100",
  danger: "bg-alert-50 text-alert-700 border-alert-100",
  info: "bg-white text-ink-700 border-border-strong",
};

/** Selo de status. O estado nunca depende só da cor: sempre há texto e, se possível, ícone. */
export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
