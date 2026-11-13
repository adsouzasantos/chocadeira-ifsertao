import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/instrumentation";

/** Indica como a tela está sendo atualizada. */
export function LiveStatus({ realtime, lastSync, now }: { realtime: boolean; lastSync: number; now: number }) {
  return (
    <p className="flex items-center gap-2 text-xs text-text-muted" aria-live="off">
      <span className={cn("relative flex size-2.5", realtime ? "text-brand-500" : "text-warning-500")} aria-hidden>
        {realtime && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
        <span className="relative inline-flex size-2.5 rounded-full bg-current" />
      </span>
      {realtime ? "Tempo real" : "Atualização automática a cada 15 s"} · sincronizado {timeAgo(new Date(lastSync).toISOString(), now)}
    </p>
  );
}
