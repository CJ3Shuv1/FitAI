import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitAI — Training, Ernährung & Rezepte",
    short_name: "FitAI",
    description: "Training, Ernährung & Rezepte — für dich, nicht für Cedric.",
    start_url: "/",
    display: "standalone",
    background_color: "#15140F",
    theme_color: "#15140F",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
