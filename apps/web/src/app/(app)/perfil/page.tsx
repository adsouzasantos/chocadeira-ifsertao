import { KeyRound, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/auth/new-password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSession } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Perfil e conta" };

export default async function PerfilPage() {
  const { user, profile } = await getSession();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Perfil e conta"
        description={`Conta criada em ${formatDate(user.created_at)}.`}
      />
      <div className="space-y-5">
        <Card>
          <CardHeader icon={<UserRound aria-hidden className="size-5" />} title="Dados pessoais" />
          <CardBody className="py-5">
            <ProfileForm fullName={profile?.full_name ?? ""} email={user.email ?? ""} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            icon={<KeyRound aria-hidden className="size-5" />}
            title="Alterar senha"
            description="Use uma senha que você não utilize em outros serviços."
          />
          <CardBody className="py-5">
            <NewPasswordForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
