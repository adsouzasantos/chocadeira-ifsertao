import { cn } from "@/lib/utils";

/**
 * Símbolo da plataforma: um ovo com a linha de leitura de um sensor.
 * Desenho próprio do projeto. O logotipo oficial do IFSertãoPB deve ser
 * aplicado conforme o manual de identidade visual da instituição.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <path
        d="M16 3C10.2 3 6 11.4 6 18.2 6 24.3 10.4 29 16 29s10-4.7 10-10.8C26 11.4 21.8 3 16 3Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M16 3C10.2 3 6 11.4 6 18.2 6 24.3 10.4 29 16 29s10-4.7 10-10.8C26 11.4 21.8 3 16 3Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M8.5 19h4l2-4.5 3 8 2-3.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ inverted = false, compact = false }: { inverted?: boolean; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", inverted ? "text-white" : "text-brand-700")}>
      <LogoMark />
      {!compact && (
        <span className="leading-tight">
          <span className={cn("block text-[0.95rem] font-semibold", inverted ? "text-white" : "text-text")}>
            Chocadeira Inteligente
          </span>
          <span className={cn("block text-xs", inverted ? "text-brand-100" : "text-text-muted")}>
            IFSertãoPB · Extensão
          </span>
        </span>
      )}
    </span>
  );
}
