"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/auth/actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <form
        action={formAction}
        className="w-full max-w-sm rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-6"
      >
        <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
          FitAI
        </div>
        <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-[var(--text)]">
          Anmelden
        </h1>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            E-Mail
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3 py-3 text-[var(--text)] outline-none focus:border-[var(--copper)]"
          />
        </label>

        <label className="mb-4 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Passwort
          </span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3 py-3 text-[var(--text)] outline-none focus:border-[var(--copper)]"
          />
        </label>

        {state?.error && (
          <p className="mb-4 text-sm text-[#C97268]">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-[var(--copper)] py-3 font-semibold text-[#1A1209] disabled:opacity-60"
        >
          {pending ? "Melde an…" : "Anmelden"}
        </button>

        <p className="mt-4 text-center text-sm text-[var(--text-dim)]">
          Noch kein Konto?{" "}
          <Link href="/signup" className="text-[var(--copper)] underline">
            Registrieren
          </Link>
        </p>
      </form>
    </div>
  );
}
