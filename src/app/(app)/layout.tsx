import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-[var(--bg)]">
      <div className="mx-4 mt-4 flex gap-1.5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
        {MODES.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="flex-1 rounded-xl px-2 py-2.5 text-center text-sm font-semibold text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            <span className="mr-1">{m.emoji}</span>
            {m.label}
          </Link>
        ))}
        <Link
          href="/settings"
          className="flex items-center justify-center rounded-xl px-3 text-[var(--text-faint)] hover:text-[var(--text)]"
          title="Einstellungen"
        >
          ⚙
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
