import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitAI",
  description: "Training, Ernährung & Rezepte — für dich, nicht für Cedric.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FitAI",
  },
};

export const viewport: Viewport = {
  themeColor: "#15140F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
