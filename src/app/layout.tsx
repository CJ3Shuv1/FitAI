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
  other: {
    // Next's `appleWebApp.capable` only emits the newer
    // "mobile-web-app-capable" tag. iOS Safari still keys its "launch
    // from home screen in standalone mode (no URL bar)" behavior off the
    // older Apple-specific tag, so both need to be present.
    "apple-mobile-web-app-capable": "yes",
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
