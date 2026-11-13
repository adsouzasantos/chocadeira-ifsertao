import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Chocadeira Inteligente · IFSertãoPB",
    template: "%s · Chocadeira Inteligente",
  },
  description:
    "Plataforma de instrumentação, monitoramento e gerenciamento de incubação. Projeto de extensão do IFSertãoPB.",
};

export const viewport: Viewport = {
  themeColor: "#016B2F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
