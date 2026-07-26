"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const FITNESS_MODES = [
  { href: "/training", emoji: "🏋️", label: "Training" },
  { href: "/nutrition", emoji: "🍽", label: "Ernährung" },
  { href: "/recipes", emoji: "🍳", label: "Rezepte" },
  { href: "/shopping", emoji: "🛒", label: "Einkauf" },
  { href: "/settings", emoji: "⚙", label: "Profil" },
];

const READING_MODES = [
  { href: "/reading", emoji: "📚", label: "Regal" },
  { href: "/settings", emoji: "⚙", label: "Profil" },
];

export default function AppNav() {
  const pathname = usePathname();

  // The hub is the mode picker itself — no nav bar there.
  if (pathname === "/hub") return null;

  const isReading = pathname.startsWith("/reading");
  const modes = isReading ? READING_MODES : FITNESS_MODES;

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
      {modes.map((m) => {
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
    </div>
  );
}
