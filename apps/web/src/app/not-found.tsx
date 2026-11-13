import { ButtonLink } from "@/components/ui/button";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark className="size-12 text-brand-600" />
      <h1 className="mt-4 text-xl font-semibold">Página não encontrada</h1>
      <p className="mt-1 text-sm text-text-muted">O endereço pode ter sido digitado incorretamente ou o item foi removido.</p>
      <ButtonLink href="/painel" className="mt-6">
        Voltar ao painel
      </ButtonLink>
    </main>
  );
}
