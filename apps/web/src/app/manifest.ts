import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chocadeira Inteligente IFSertãoPB",
    short_name: "Chocadeira",
    description: "Monitoramento de chocadeiras e acompanhamento de ninhadas",
    start_url: "/painel",
    display: "standalone",
    background_color: "#FDF7E6",
    theme_color: "#016B2F",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
