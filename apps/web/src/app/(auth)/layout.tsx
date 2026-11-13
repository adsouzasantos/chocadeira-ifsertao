import { Activity, CalendarDays, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const highlights = [
  { icon: Activity, text: "Temperatura, umidade e nível de água acompanhados de perto" },
  { icon: CalendarDays, text: "Calendário de cada ninhada, da colocação ao nascimento" },
  { icon: ShieldCheck, text: "Seus dados visíveis apenas para você e sua equipe" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-10 text-white lg:flex">
        <Logo inverted />
        <div className="relative z-10 max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">
            Tecnologia social para a avicultura familiar no semiárido.
          </h2>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-brand-50">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon aria-hidden className="size-4.5" />
                </span>
                <span className="pt-1 text-[0.9375rem]">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 text-sm text-brand-100">
          Projeto de extensão do Instituto Federal do Sertão Paraibano
        </p>
        {/* Ovo decorativo de fundo, discreto */}
        <svg aria-hidden viewBox="0 0 200 260" className="absolute -right-16 -bottom-20 h-[26rem] text-white/[0.06]">
          <path d="M100 0C45 0 0 85 0 150c0 62 45 110 100 110s100-48 100-110C200 85 155 0 100 0Z" fill="currentColor" />
        </svg>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
