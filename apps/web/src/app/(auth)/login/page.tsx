import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/alert";
import { safeRedirectPath } from "@/lib/utils";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-text-muted">Acompanhe suas chocadeiras e ninhadas.</p>
      {erro === "link" && (
        <div className="mb-4">
          <Alert tone="error">O link é inválido ou expirou. Solicite um novo envio.</Alert>
        </div>
      )}
      <LoginForm next={next ? safeRedirectPath(next) : undefined} />
      <p className="mt-6 text-center text-sm text-text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-link underline-offset-4 hover:underline">
          Cadastre-se
        </Link>
      </p>
    </>
  );
}
