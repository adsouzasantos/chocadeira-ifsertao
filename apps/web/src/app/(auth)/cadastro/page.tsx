import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function CadastroPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 mb-6 text-[0.9375rem] text-text-muted">
        Cadastre-se para registrar suas chocadeiras e acompanhar cada ninhada.
      </p>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-link underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </>
  );
}
