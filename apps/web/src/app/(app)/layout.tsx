import { Sidebar } from "@/components/layout/sidebar";
import { AlarmWatcher } from "@/components/instrumentation/alarm-watcher";
import { getSession } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, supabase } = await getSession();
  const { data: activeAlarms } = await supabase.from("alarms").select("id").is("resolved_at", null);

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <AlarmWatcher initialActive={activeAlarms ?? []} />
      <Sidebar userName={profile?.full_name ?? ""} userEmail={user.email ?? ""} />
      <div className="lg:pl-64">
        <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
