import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";

export const dynamic = "force-dynamic";

/** Exibida quando as variáveis do Supabase ainda não foram definidas. */
export default function ConfiguracaoPage() {
  if (isSupabaseConfigured()) redirect("/login");

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-10">
      <Logo />
      <h1 className="text-2xl font-semibold">Configuração pendente</h1>
      <Alert tone="info">
        A aplicação ainda não está conectada ao banco de dados. Copie o arquivo{" "}
        <code className="rounded bg-cream-200 px-1">apps/web/.env.example</code> para{" "}
        <code className="rounded bg-cream-200 px-1">apps/web/.env.local</code>, preencha a URL e a chave pública do
        projeto Supabase e reinicie o servidor.
      </Alert>
      <p className="text-sm text-text-muted">O passo a passo completo está no arquivo README.md do projeto.</p>
    </main>
  );
}
