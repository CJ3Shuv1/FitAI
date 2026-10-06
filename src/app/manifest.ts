import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FitAI — dein Alltags-Tool",
    short_name: "FitAI",
    description: "Training, Ernährung, Bücher, Schlaf und eine Gesamtanalyse — an einem Ort.",
    lang: "de",
    start_url: "/hub",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#15140F",
    theme_color: "#15140F",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
