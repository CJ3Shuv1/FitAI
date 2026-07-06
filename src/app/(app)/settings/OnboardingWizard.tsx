"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Goal } from "@/lib/types";
import { computeTargets, PHASE_DEFAULTS } from "@/lib/types";
import { saveProfile } from "./actions";

type FormState = {
  weight: string;
  height: string;
  age: string;
  goal: Goal | "";
  activityFactor: string;
  proteinPerKg: string;
  fatPercent: string;
  kcalAdjust: string;
  sugarPercent: string;
};

const STEP_LABELS = ["Körper", "Phase", "Aktivität", "Feinschliff"];

function OptCard({
  emoji,
  label,
  on,
  onClick,
}: {
  emoji: string;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-2xl border p-4 transition-colors ${
        on
          ? "border-[var(--copper)] bg-[rgba(217,123,63,0.12)]"
          : "border-[var(--hairline)] bg-[var(--surface)]"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <span
        className={`text-xs font-semibold ${on ? "text-[var(--copper)]" : "text-[var(--text-dim)]"}`}
      >
        {label}
      </span>
    </button>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6 flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i <= current ? "bg-[var(--copper)]" : "bg-[var(--hairline)]"
          }`}
        />
      ))}
    </div>
  );
}

function SlideWrap({ children, dir }: { children: React.ReactNode; dir: "right" | "left" }) {
  // Relies on the caller remounting this component (via `key`) whenever the
  // step changes, so `settled` naturally starts false on each new step.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 20);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="flex-1 transition-all duration-300 ease-out"
      style={{
        transform: settled ? "translateX(0)" : `translateX(${dir === "right" ? 24 : -24}px)`,
        opacity: settled ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
}

type ConfettiPiece = { x: number; delay: number; color: string; size: number };

function Confetti() {
  const [pieces] = useState<ConfettiPiece[]>(() =>
    Array.from({ length: 36 }, (_, i) => ({
      x: Math.random() * 100,
      delay: Math.random() * 1.2,
      color: ["#D97B3F", "#8B95A1", "#7FA66B", "#EDE8DD"][i % 4],
      size: 5 + Math.random() * 6,
    }))
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute -top-2 rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            opacity: 0.85,
            animation: `fitai-confetti-fall 2.2s ${p.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`@keyframes fitai-confetti-fall { to { transform: translateY(100vh) rotate(540deg); opacity: 0; } }`}</style>
    </div>
  );
}

export default function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=welcome, 1..4=data, 5=done
  const [dir, setDir] = useState<"right" | "left">("right");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    weight: "",
    height: "",
    age: "",
    goal: "",
    activityFactor: "",
    proteinPerKg: "",
    fatPercent: "27",
    kcalAdjust: "",
    sugarPercent: "8",
  });

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function go(delta: 1 | -1) {
    setDir(delta > 0 ? "right" : "left");
    setStep((s) => s + delta);
  }

  const bodyValid = form.weight && form.height && form.age;
  const phaseValid = !!form.goal;
  const activityValid = !!form.activityFactor;

  const numericPreview = (() => {
    const w = parseFloat(form.weight);
    const h = parseFloat(form.height);
    const a = parseFloat(form.age);
    const af = parseFloat(form.activityFactor);
    const ppk = parseFloat(form.proteinPerKg);
    const fp = parseFloat(form.fatPercent);
    const ka = parseFloat(form.kcalAdjust);
    const sp = parseFloat(form.sugarPercent);
    if ([w, h, a, af, ppk, fp, ka, sp].some((n) => Number.isNaN(n))) return null;
    return computeTargets({
      weight: w,
      height: h,
      age: a,
      activity_factor: af,
      protein_per_kg: ppk,
      fat_percent: fp,
      kcal_adjust: ka,
      sugar_percent: sp,
    });
  })();

  async function finish() {
    setSaving(true);
    const fd = new FormData();
    fd.set("weight", form.weight);
    fd.set("height", form.height);
    fd.set("age", form.age);
    fd.set("goal", form.goal);
    fd.set("activity_factor", form.activityFactor);
    fd.set("protein_per_kg", form.proteinPerKg);
    fd.set("fat_percent", form.fatPercent);
    fd.set("kcal_adjust", form.kcalAdjust);
    fd.set("sugar_percent", form.sugarPercent);
    await saveProfile(fd);
    router.push("/training");
  }

  return (
    <div className="relative flex min-h-[70vh] flex-col overflow-hidden">
      {step === 0 && (
        <SlideWrap dir={dir}>
          <div className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--copper-dim)] via-[var(--copper)] to-[#B5591F] p-7">
            <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#1A1209]/70">
              FitAI
            </div>
            <h1 className="mb-2 text-3xl font-black leading-tight tracking-tight text-[#1A1209]">
              Willkommen.
              <br />
              Lass uns loslegen. 💪
            </h1>
            <p className="text-sm leading-relaxed text-[#1A1209]/80">
              Ein paar kurze Fragen zu dir — damit wir deine Kalorien- und
              Makro-Ziele passgenau berechnen können. Dauert ~30 Sekunden.
            </p>
          </div>

          <div className="mb-6 space-y-3">
            {[
              ["🎯", "Ziele, die zu dir passen", "Bulk, Cut oder Maintenance — deine Zahlen, kein Rätselraten."],
              ["🍽", "KI-Ernährungsanalyse", "Beschreib was du gegessen hast, wir schätzen die Makros."],
              ["🏋️", "Dein eigener Trainingsplan", "Manuell anlegen oder als Foto/PDF hochladen."],
            ].map(([emoji, title, desc]) => (
              <div key={title} className="flex items-start gap-3">
                <span className="text-xl">{emoji}</span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-[var(--text-faint)]">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => go(1)}
            className="w-full rounded-2xl bg-[var(--copper)] py-4 text-sm font-bold text-[#1A1209]"
          >
            Los geht&apos;s →
          </button>
        </SlideWrap>
      )}

      {step >= 1 && step <= 4 && (
        <>
          <ProgressBar current={step - 1} total={STEP_LABELS.length} />
          <SlideWrap dir={dir} key={step}>
            {step === 1 && (
              <div>
                <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Deine Eckdaten</h2>
                <p className="mb-5 text-sm text-[var(--text-dim)]">
                  Nur für die Berechnung — bleibt privat, keine Standardwerte.
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <div className="mb-1 font-mono text-[9.5px] uppercase text-[var(--text-faint)]">
                      Gewicht
                    </div>
                    <input
                      type="number"
                      autoFocus
                      value={form.weight}
                      onChange={(e) => set({ weight: e.target.value })}
                      className="w-full bg-transparent text-xl font-bold outline-none"
                      placeholder="—"
                    />
                    <span className="text-[11px] text-[var(--text-faint)]">kg</span>
                  </div>
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <div className="mb-1 font-mono text-[9.5px] uppercase text-[var(--text-faint)]">
                      Größe
                    </div>
                    <input
                      type="number"
                      value={form.height}
                      onChange={(e) => set({ height: e.target.value })}
                      className="w-full bg-transparent text-xl font-bold outline-none"
                      placeholder="—"
                    />
                    <span className="text-[11px] text-[var(--text-faint)]">cm</span>
                  </div>
                  <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3">
                    <div className="mb-1 font-mono text-[9.5px] uppercase text-[var(--text-faint)]">
                      Alter
                    </div>
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => set({ age: e.target.value })}
                      className="w-full bg-transparent text-xl font-bold outline-none"
                      placeholder="—"
                    />
                    <span className="text-[11px] text-[var(--text-faint)]">Jahre</span>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Was ist deine Phase?</h2>
                <p className="mb-5 text-sm text-[var(--text-dim)]">
                  Bestimmt dein Kalorien- und Proteinziel. Später jederzeit änderbar.
                </p>
                <div className="flex gap-2.5">
                  {(
                    [
                      ["bulk", "💪", "Bulk"],
                      ["cut", "🔥", "Cut"],
                      ["maintenance", "⚖️", "Maintenance"],
                    ] as const
                  ).map(([val, emoji, label]) => (
                    <OptCard
                      key={val}
                      emoji={emoji}
                      label={label}
                      on={form.goal === val}
                      onClick={() => {
                        const d = PHASE_DEFAULTS[val];
                        set({ goal: val, proteinPerKg: String(d.protein_per_kg), kcalAdjust: String(d.kcal_adjust) });
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Wie aktiv bist du?</h2>
                <p className="mb-5 text-sm text-[var(--text-dim)]">
                  Fließt in deinen täglichen Kalorienbedarf (TDEE) ein.
                </p>
                <div className="space-y-2">
                  {(
                    [
                      ["1.2", "🛋️", "Sitzend", "Bürojob, kaum Bewegung"],
                      ["1.375", "🚶", "Leicht aktiv", "Gelegentlich Sport"],
                      ["1.55", "🏃", "Aktiv", "3–5x Training/Woche"],
                      ["1.65", "🏋️", "Sehr aktiv", "4x+ intensives Krafttraining"],
                      ["1.9", "🔥", "Extrem aktiv", "Täglich hartes Training"],
                    ] as const
                  ).map(([val, emoji, label, desc]) => (
                    <button
                      key={val}
                      onClick={() => set({ activityFactor: val })}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        form.activityFactor === val
                          ? "border-[var(--copper)] bg-[rgba(217,123,63,0.12)]"
                          : "border-[var(--hairline)] bg-[var(--surface)]"
                      }`}
                    >
                      <span className="text-xl">{emoji}</span>
                      <div>
                        <div
                          className={`text-sm font-semibold ${form.activityFactor === val ? "text-[var(--copper)]" : "text-[var(--text)]"}`}
                        >
                          {label}
                        </div>
                        <div className="text-xs text-[var(--text-faint)]">{desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="mb-1 text-2xl font-extrabold tracking-tight">Fast fertig!</h2>
                <p className="mb-5 text-sm text-[var(--text-dim)]">
                  Zwei Feineinstellungen für die Makro-Formel — Standardwerte
                  passen für die meisten, du kannst sie jederzeit anpassen.
                </p>
                <label className="mb-4 block">
                  <span className="mb-2 flex justify-between font-mono text-[11px] text-[var(--text-dim)]">
                    <span>Fett-Anteil</span>
                    <span className="text-[var(--copper)]">{form.fatPercent}% kcal</span>
                  </span>
                  <input
                    type="range"
                    min={15}
                    max={40}
                    value={form.fatPercent}
                    onChange={(e) => set({ fatPercent: e.target.value })}
                    className="w-full"
                  />
                </label>
                <label className="mb-2 block">
                  <span className="mb-2 flex justify-between font-mono text-[11px] text-[var(--text-dim)]">
                    <span>Zucker-Limit</span>
                    <span className="text-[var(--copper)]">{form.sugarPercent}% kcal</span>
                  </span>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={form.sugarPercent}
                    onChange={(e) => set({ sugarPercent: e.target.value })}
                    className="w-full"
                  />
                </label>
              </div>
            )}
          </SlideWrap>

          <div className="mt-6 flex gap-2.5">
            <button
              onClick={() => go(-1)}
              className="rounded-xl px-5 py-3 text-sm font-semibold text-[var(--text-dim)]"
            >
              ← Zurück
            </button>
            <button
              onClick={() => go(1)}
              disabled={
                (step === 1 && !bodyValid) ||
                (step === 2 && !phaseValid) ||
                (step === 3 && !activityValid)
              }
              className="flex-1 rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209] disabled:opacity-40"
            >
              Weiter →
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <SlideWrap dir={dir}>
          <Confetti />
          <div className="relative z-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--copper)]">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight">Alles bereit!</h2>
            <p className="mb-6 text-sm text-[var(--text-dim)]">
              Deine persönlichen Ziele sind berechnet. Auf geht&apos;s.
            </p>

            {numericPreview && (
              <div className="mb-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4 text-left">
                <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  Dein Profil
                </div>
                <SummaryRow k="Kalorien" v={`${numericPreview.kcal} kcal`} />
                <SummaryRow k="Protein" v={`${numericPreview.protein}g`} />
                <SummaryRow k="Carbs" v={`${numericPreview.carbs}g`} />
                <SummaryRow k="Fett" v={`${numericPreview.fett}g`} />
                <SummaryRow k="Zucker-Limit" v={`≤${numericPreview.zucker}g`} />
              </div>
            )}

            <button
              onClick={finish}
              disabled={saving}
              className="w-full rounded-2xl bg-[var(--copper)] py-4 text-sm font-bold text-[#1A1209] disabled:opacity-60"
            >
              {saving ? "Speichere…" : "Zum Trainingsplan →"}
            </button>
          </div>
        </SlideWrap>
      )}
    </div>
  );
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--hairline)] py-2 text-sm last:border-none">
      <span className="text-[var(--text-faint)]">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
