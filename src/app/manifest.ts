import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Campo Vivo | Gestão Equestre",
    short_name: "Campo Vivo",
    description: "Gestão simples para centros de treinamento e haras.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2e9",
    theme_color: "#174b3a",
    icons: [
      {
        src: "/icons/campo-vivo-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/campo-vivo-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
