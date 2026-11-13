import type { Metadata } from "next";
import Link from "next/link";
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function RecuperarSenhaPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-text-muted">
        Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
      </p>
      <ResetRequestForm />
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-medium text-link underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </>
  );
}
