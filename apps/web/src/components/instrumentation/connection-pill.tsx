import { CircleSlash, Clock, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ConnectionState } from "@/lib/instrumentation";

const map = {
  online: { tone: "success", icon: Wifi, label: "Online" },
  stale: { tone: "warning", icon: Clock, label: "Sem atualização" },
  offline: { tone: "danger", icon: WifiOff, label: "Offline" },
  none: { tone: "neutral", icon: CircleSlash, label: "Sem dispositivo" },
} as const;

export function ConnectionPill({ state }: { state: ConnectionState }) {
  const { tone, icon: Icon, label } = map[state];
  return (
    <Badge tone={tone} icon={<Icon aria-hidden className="size-3.5" />}>
      {label}
    </Badge>
  );
}
