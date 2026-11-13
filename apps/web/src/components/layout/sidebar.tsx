"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { ALARM_COUNT_EVENT } from "@/components/instrumentation/alarm-watcher";
import { cn } from "@/lib/utils";
import { mainNav, secondaryNav, type NavItem } from "./nav-items";

function NavLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-11 items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-medium transition-colors",
        active
          ? "bg-nav-active text-white shadow-[inset_3px_0_0_var(--color-cream-100)]"
          : "text-brand-50 hover:bg-white/10 hover:text-white",
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      <span className="flex-1">{item.label}</span>
      {badge ? (
        <span className="min-w-6 rounded-full bg-alert-500 px-1.5 py-0.5 text-center text-xs font-semibold text-white">
          {badge}
          <span className="sr-only"> alarmes ativos</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavContent({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  const [alarmCount, setAlarmCount] = useState(0);
  useEffect(() => {
    const onCount = (e: Event) => setAlarmCount((e as CustomEvent<number>).detail);
    window.addEventListener(ALARM_COUNT_EVENT, onCount);
    return () => window.removeEventListener(ALARM_COUNT_EVENT, onCount);
  }, []);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pr-14 pb-8 lg:pr-5">
        <Logo inverted />
      </div>
      <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3">
        {mainNav.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
            badge={item.href === "/alarmes" ? alarmCount : undefined}
          />
        ))}
      </nav>
      <div className="space-y-1 border-t border-white/10 px-3 py-4">
        {secondaryNav.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
        <form action={signOut}>
          <button
            type="submit"
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-medium text-brand-50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut aria-hidden className="size-5" />
            Sair
          </button>
        </form>
        <div className="px-3 pt-3">
          <p className="truncate text-sm font-medium text-white">{userName || "Usuário"}</p>
          <p className="truncate text-xs text-brand-100">{userEmail}</p>
        </div>
      </div>
    </div>
  );
}

/** Menu lateral fixo no computador e gaveta no celular. */
export function Sidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Fecha a gaveta ao navegar
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Barra superior (celular e tablet) */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-nav px-4 lg:hidden">
        <Logo inverted compact />
        <span className="text-sm font-semibold text-white">Chocadeira Inteligente</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          aria-controls="menu-movel"
          className="flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <Menu aria-hidden className="size-6" />
        </button>
      </header>

      {/* Gaveta (celular e tablet) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 bg-ink-900/50"
            onClick={() => setOpen(false)}
          />
          <div id="menu-movel" className="absolute inset-y-0 left-0 w-[17.5rem] max-w-[85vw] bg-nav shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-4 right-3 flex size-11 items-center justify-center rounded-lg text-white hover:bg-white/10"
            >
              <X aria-hidden className="size-6" />
            </button>
            <NavContent userName={userName} userEmail={userEmail} />
          </div>
        </div>
      )}

      {/* Menu fixo (computador) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 bg-nav lg:block">
        <NavContent userName={userName} userEmail={userEmail} />
      </aside>
    </>
  );
}
