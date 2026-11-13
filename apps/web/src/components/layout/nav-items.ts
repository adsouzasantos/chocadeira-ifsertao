import { Bell, LayoutDashboard, ThermometerSun, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const mainNav: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/chocadeiras", label: "Chocadeiras", icon: ThermometerSun },
  { href: "/alarmes", label: "Alarmes", icon: Bell },
];

export const secondaryNav: NavItem[] = [{ href: "/perfil", label: "Perfil e conta", icon: UserRound }];
