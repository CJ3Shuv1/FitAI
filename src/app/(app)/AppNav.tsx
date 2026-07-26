"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; emoji: string; label: string };

// Each "area" reachable from the hub gets its own scoped tab set — adding a
// new hub tile later just means adding one more entry here (and, if it
// should feed the overall analysis, registering it in lib/analysisModules).
const AREAS: { match: (path: string) => boolean; tabs: NavItem[] }[] = [
  {
    match: (p) => p.startsWith("/training"),
    tabs: [{ href: "/training", emoji: "🏋️", label: "Training" }],
  },
  {
    match: (p) => p.startsWith("/nutrition") || p.startsWith("/recipes") || p.startsWith("/shopping"),
    tabs: [
      { href: "/nutrition", emoji: "🍽", label: "Ernährung" },
      { href: "/recipes", emoji: "🍳", label: "Rezepte" },
      { href: "/shopping", emoji: "🛒", label: "Einkauf" },
    ],
  },
  {
    match: (p) => p.startsWith("/reading"),
    tabs: [{ href: "/reading", emoji: "📚", label: "Regal" }],
  },
  {
    match: (p) => p.startsWith("/sleep"),
    tabs: [{ href: "/sleep", emoji: "🌙", label: "Schlaf" }],
  },
  {
    match: (p) => p.startsWith("/analysis"),
    tabs: [{ href: "/analysis", emoji: "📊", label: "Analyse" }],
  },
];

export default function AppNav() {
  const pathname = usePathname();

  // The hub is the mode picker itself — no nav bar there.
  if (pathname === "/hub") return null;

  const area = AREAS.find((a) => a.match(pathname));
  const tabs = area?.tabs ?? [];

  return (
    <div className="mx-2 mt-4 flex items-stretch gap-1 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1 sm:mx-4">
      <Link
        href="/hub"
        title="Bereich wechseln"
        className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2.5 text-[var(--text-faint)] hover:text-[var(--text)]"
      >
        <span className="text-base leading-none">⌂</span>
        <span className="font-mono text-[9px] font-semibold uppercase leading-none">
          Hub
        </span>
      </Link>
      {tabs.map((m) => {
        const active = pathname.startsWith(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 ${
              active
                ? "bg-[var(--surface-raised)] text-[var(--text)]"
                : "text-[var(--text-faint)] hover:text-[var(--text)]"
            }`}
          >
            <span className="text-base leading-none">{m.emoji}</span>
            <span className="w-full truncate text-center font-mono text-[9px] font-semibold uppercase leading-none">
              {m.label}
            </span>
          </Link>
        );
      })}
      <Link
        href="/settings"
        className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 ${
          pathname.startsWith("/settings")
            ? "bg-[var(--surface-raised)] text-[var(--text)]"
            : "text-[var(--text-faint)] hover:text-[var(--text)]"
        }`}
      >
        <span className="text-base leading-none">⚙</span>
        <span className="w-full truncate text-center font-mono text-[9px] font-semibold uppercase leading-none">
          Profil
        </span>
      </Link>
    </div>
  );
}
