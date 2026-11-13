import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "error" | "success" | "info";

const styles: Record<Tone, { box: string; icon: ReactNode }> = {
  error: {
    box: "border-alert-100 bg-alert-50 text-alert-800",
    icon: <CircleAlert aria-hidden className="size-5 shrink-0 text-alert-500" />,
  },
  success: {
    box: "border-brand-200 bg-brand-50 text-brand-900",
    icon: <CircleCheck aria-hidden className="size-5 shrink-0 text-brand-600" />,
  },
  info: {
    box: "border-border-strong bg-white text-ink-700",
    icon: <Info aria-hidden className="size-5 shrink-0 text-brand-600" />,
  },
};

export function Alert({ tone = "info", children }: { tone?: Tone; children: ReactNode }) {
  const s = styles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed", s.box)}
    >
      {s.icon}
      <div>{children}</div>
    </div>
  );
}
