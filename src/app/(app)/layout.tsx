import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { themeCssVars } from "@/lib/themes";
import type { CSSProperties } from "react";

const MODES = [
  { href: "/training", emoji: "🏋️", label: "Training" },
  { href: "/nutrition", emoji: "🍽", label: "Ernährung" },
  { href: "/recipes", emoji: "🍳", label: "Rezepte" },
  { href: "/shopping", emoji: "🛒", label: "Einkauf" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("theme")
    .eq("user_id", user.id)
    .maybeSingle();

  const style = themeCssVars(settings?.theme ?? "copper") as CSSProperties;

  return (
    <div
      style={style}
      className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-[var(--bg)]"
    >
      <div className="mx-2 mt-4 flex gap-1 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1 sm:mx-4">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <span className="text-base leading-none">{m.emoji}</span>
            <span className="w-full truncate text-center font-mono text-[9px] font-semibold uppercase leading-none">
              {m.label}
            </span>
          </Link>
        ))}
        <Link
          href="/settings"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          <span className="text-base leading-none">⚙</span>
          <span className="w-full truncate text-center font-mono text-[9px] font-semibold uppercase leading-none">
            Profil
          </span>
        </Link>
      </div>

      <main className="flex-1 px-4 pb-10 pt-2">{children}</main>

      <div className="px-4 pb-6 text-center">
        <form action={signOut}>
          <button
            type="submit"
            className="font-mono text-[10.5px] text-[var(--text-faint)] underline"
          >
            Abmelden ({user.email})
          </button>
        </form>
      </div>
    </div>
  );
}
