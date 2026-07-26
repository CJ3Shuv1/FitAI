"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Exercise, ExerciseLibraryItem, MuscleGroup, TrainingDay } from "@/lib/types";
import { MUSCLE_GROUP_LABELS } from "@/lib/types";
import { normalizeName } from "@/lib/exerciseSync";
import {
  addDay,
  addExercise,
  deleteDay,
  deleteExercise,
  manualLink,
  resolveLinkDecision,
  updateExercise,
  type LinkPrompt,
} from "./actions";

export default function TrainingBoard({
  initialDays,
  initialExercises,
  library,
}: {
  initialDays: TrainingDay[];
  initialExercises: Exercise[];
  library: ExerciseLibraryItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [activeDayId, setActiveDayId] = useState<string | null>(
    initialDays[0]?.id ?? null
  );
  const [linkPrompt, setLinkPrompt] = useState<
    (LinkPrompt & { exerciseId: string }) | null
  >(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showLinkBuilder, setShowLinkBuilder] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const refresh = () => startTransition(() => router.refresh());

  const activeDay =
    initialDays.find((d) => d.id === activeDayId) ?? initialDays[0] ?? null;
  const exercisesForDay = useMemo(
    () =>
      initialExercises
        .filter((e) => e.day_id === activeDay?.id)
        .sort((a, b) => a.position - b.position),
    [initialExercises, activeDay]
  );

  async function handleUpdate(
    exerciseId: string,
    patch: Partial<Pick<Exercise, "name" | "sets" | "reps" | "weight" | "notes">>
  ) {
    const result = await updateExercise(exerciseId, patch);
    if (result.needsLinkDecision) {
      setLinkPrompt({ ...result, exerciseId });
    }
    refresh();
  }

  if (initialDays.length === 0) {
    return (
      <div>
        <h1 className="mb-1 text-3xl font-extrabold uppercase tracking-tight">
          Training
        </h1>
        <p className="mb-6 text-sm text-[var(--text-dim)]">
          Noch kein Trainingsplan angelegt.
        </p>
        <div className="mb-3 rounded-2xl border border-dashed border-[var(--hairline)] p-5 text-center text-sm text-[var(--text-faint)]">
          Lege einen Tag manuell an oder lade deinen Plan als PDF, Foto oder
          Excel hoch — wir übernehmen die Übungen automatisch.
        </div>
        <a
          href="/training/upload"
          className="mb-3 flex items-center justify-center gap-2 rounded-2xl bg-[var(--copper)] p-3.5 text-sm font-bold text-[#1A1209]"
        >
          📄 Plan hochladen
        </a>
        <AddDayForm onDone={refresh} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold uppercase tracking-tight">
        {activeDay?.label}
      </h1>
      <p className="mb-4 text-sm text-[var(--text-dim)]">{activeDay?.sub}</p>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {initialDays.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDayId(d.id)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
              d.id === activeDay?.id
                ? "border-[var(--copper-dim)] bg-[var(--surface-raised)] text-[var(--text)]"
                : "border-[var(--hairline)] text-[var(--text-faint)]"
            }`}
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setShowAddDay(true)}
          className="shrink-0 rounded-full border border-dashed border-[var(--hairline)] px-4 py-2 text-sm text-[var(--text-faint)]"
        >
          + Tag
        </button>
      </div>

      {showAddDay && (
        <div className="mb-4">
          <AddDayForm
            onDone={() => {
              setShowAddDay(false);
              refresh();
            }}
          />
        </div>
      )}

      {activeDay && (
        <button
          onClick={async () => {
            if (confirm(`Tag "${activeDay.label}" wirklich löschen?`)) {
              await deleteDay(activeDay.id);
              setActiveDayId(null);
              refresh();
            }
          }}
          className="mb-4 font-mono text-[10.5px] text-[var(--text-faint)] underline"
        >
          Diesen Tag löschen
        </button>
      )}

      <div className="space-y-2.5">
        {exercisesForDay.map((ex) => (
          <ExerciseCard
            key={ex.id}
            exercise={ex}
            library={library}
            onUpdate={(patch) => handleUpdate(ex.id, patch)}
            onDelete={async () => {
              if (confirm(`"${ex.name}" löschen?`)) {
                await deleteExercise(ex.id);
                refresh();
              }
            }}
          />
        ))}
      </div>

      {activeDay && (
        <button
          onClick={async () => {
            await addExercise(activeDay.id, "Neue Übung");
            refresh();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--hairline)] p-3.5 text-sm text-[var(--text-faint)]"
        >
          + Übung hinzufügen
        </button>
      )}

      <button
        onClick={() => setShowLinkBuilder(true)}
        className="mt-3 w-full text-center font-mono text-[10.5px] text-[var(--text-faint)] underline"
      >
        ⛓ Zwei Übungen manuell koppeln
      </button>

      {showLinkBuilder && (
        <LinkBuilderModal
          days={initialDays}
          exercises={initialExercises}
          onClose={() => setShowLinkBuilder(false)}
          onConfirm={async (id1, id2) => {
            await manualLink(id1, id2);
            setShowLinkBuilder(false);
            refresh();
            showToast("Übungen gekoppelt – Sätze & Gewicht synchron");
          }}
        />
      )}

      {linkPrompt && (
        <SyncModal
          exerciseName={linkPrompt.exerciseName}
          otherDayLabels={linkPrompt.otherDayLabels}
          onConfirm={async () => {
            await resolveLinkDecision(
              linkPrompt.exerciseId,
              linkPrompt.normName,
              "linked"
            );
            setLinkPrompt(null);
            refresh();
            showToast("Verknüpft – wird ab jetzt automatisch synchronisiert");
          }}
          onDecline={async () => {
            await resolveLinkDecision(
              linkPrompt.exerciseId,
              linkPrompt.normName,
              "dismissed"
            );
            setLinkPrompt(null);
            showToast("Bleibt an diesem Tag unabhängig");
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-2.5 text-[12.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

function AddDayForm({ onDone }: { onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [sub, setSub] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!label.trim()) return;
        await addDay(label.trim(), sub.trim());
        setLabel("");
        setSub("");
        onDone();
      }}
      className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4"
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="z.B. Push A"
        className="mb-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none focus:border-[var(--copper)]"
      />
      <input
        value={sub}
        onChange={(e) => setSub(e.target.value)}
        placeholder="z.B. Brust · Schulter · Trizeps"
        className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm outline-none focus:border-[var(--copper)]"
      />
      <button
        type="submit"
        className="w-full rounded-xl bg-[var(--copper)] py-2.5 text-sm font-bold text-[#1A1209]"
      >
        Tag anlegen
      </button>
    </form>
  );
}

function ExerciseCard({
  exercise,
  library,
  onUpdate,
  onDelete,
}: {
  exercise: Exercise;
  library: ExerciseLibraryItem[];
  onUpdate: (
    patch: Partial<Pick<Exercise, "name" | "sets" | "reps" | "weight" | "notes">>
  ) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets ?? 0);
  const [reps, setReps] = useState(exercise.reps ?? 0);
  const [weight, setWeight] = useState<number | null>(exercise.weight);
  const [showAlternative, setShowAlternative] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name !== exercise.name) onUpdate({ name });
          }}
          className="w-full border-b border-transparent bg-transparent text-[16px] font-semibold outline-none focus:border-dashed focus:border-[var(--copper)]"
        />
        <button
          onClick={() => setShowAlternative(true)}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-faint)]"
          title="Alternative Übung"
        >
          🔄
        </button>
        <button
          onClick={onDelete}
          className="shrink-0 rounded-lg p-1.5 text-[var(--text-faint)]"
          title="Löschen"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Sätze
            </span>
            <input
              type="number"
              value={sets}
              onChange={(e) => setSets(parseInt(e.target.value, 10) || 0)}
              onBlur={() => {
                if (sets !== exercise.sets) onUpdate({ sets });
              }}
              className="h-[34px] w-[42px] rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] text-center font-mono text-lg font-semibold outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Wdh.
            </span>
            <input
              type="number"
              value={reps}
              onChange={(e) => setReps(parseInt(e.target.value, 10) || 0)}
              onBlur={() => {
                if (reps !== exercise.reps) onUpdate({ reps });
              }}
              className="h-[34px] w-[42px] rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] text-center font-mono text-lg font-semibold outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const w = Math.max(0, (weight ?? 0) - 2.5);
              setWeight(w);
              onUpdate({ weight: w });
            }}
            className="h-8 w-8 shrink-0 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] font-bold text-[var(--steel)]"
          >
            −
          </button>
          <span className="w-16 text-center font-mono text-xl font-bold">
            {weight ?? "–"}
          </span>
          <button
            onClick={() => {
              const w = (weight ?? 0) + 2.5;
              setWeight(w);
              onUpdate({ weight: w });
            }}
            className="h-8 w-8 shrink-0 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] font-bold text-[var(--steel)]"
          >
            +
          </button>
          <span className="text-xs text-[var(--text-faint)]">kg</span>
        </div>
      </div>

      {showAlternative && (
        <AlternativeModal
          currentName={exercise.name}
          library={library}
          onClose={() => setShowAlternative(false)}
          onPick={(altName) => {
            setName(altName);
            setWeight(null);
            onUpdate({ name: altName, weight: null });
            setShowAlternative(false);
          }}
        />
      )}
    </div>
  );
}

function AlternativeModal({
  currentName,
  library,
  onClose,
  onPick,
}: {
  currentName: string;
  library: ExerciseLibraryItem[];
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const matched = library.find((l) => normalizeName(l.name) === normalizeName(currentName));
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(matched?.muscle_group ?? "brust");

  const options = library.filter(
    (l) => l.muscle_group === muscleGroup && normalizeName(l.name) !== normalizeName(currentName)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-[560px] rounded-t-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
          🔄 Alternative Übung
        </div>
        <div className="mb-4 text-base font-bold">{currentName}</div>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Muskelgruppe
          </span>
          <select
            value={muscleGroup}
            onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {(Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((g) => (
              <option key={g} value={g}>
                {MUSCLE_GROUP_LABELS[g]}
              </option>
            ))}
          </select>
        </label>

        {!matched && (
          <p className="mb-3 text-[11.5px] text-[var(--text-faint)]">
            &quot;{currentName}&quot; nicht in der Übungs-Bibliothek gefunden — bitte Muskelgruppe manuell wählen.
          </p>
        )}

        <div className="mb-4 max-h-[40vh] space-y-1.5 overflow-y-auto">
          {options.length === 0 && (
            <p className="text-sm text-[var(--text-faint)]">Keine Alternativen für diese Gruppe.</p>
          )}
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onPick(opt.name)}
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 text-left text-sm hover:border-[var(--copper-dim)]"
            >
              {opt.name}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-[var(--text-dim)]"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function SyncModal({
  exerciseName,
  otherDayLabels,
  onConfirm,
  onDecline,
}: {
  exerciseName: string;
  otherDayLabels: string[];
  onConfirm: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-[560px] rounded-t-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
          ⛓ Verknüpfte Übung
        </div>
        <div className="mb-1.5 text-base font-bold">{exerciseName}</div>
        <p className="mb-5 text-[13px] text-[var(--text-dim)]">
          Diese Übung kommt auch in{" "}
          <b>{otherDayLabels.join(", ")}</b> vor. Soll die Änderung (Übung,
          Sätze, Gewicht) dort übernommen werden?
        </p>
        <button
          onClick={onConfirm}
          className="mb-2.5 w-full rounded-xl bg-[var(--copper)] py-3.5 text-sm font-semibold text-[#1A1209]"
        >
          Überall übernehmen
        </button>
        <button
          onClick={onDecline}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-[var(--text-dim)]"
        >
          Nur hier ändern
        </button>
      </div>
    </div>
  );
}

function LinkBuilderModal({
  days,
  exercises,
  onClose,
  onConfirm,
}: {
  days: TrainingDay[];
  exercises: Exercise[];
  onClose: () => void;
  onConfirm: (id1: string, id2: string) => void;
}) {
  const [day1, setDay1] = useState(days[0]?.id ?? "");
  const [day2, setDay2] = useState(days[1]?.id ?? days[0]?.id ?? "");
  const exOfDay1 = exercises.filter((e) => e.day_id === day1);
  const exOfDay2 = exercises.filter((e) => e.day_id === day2);
  const [ex1, setEx1] = useState(exOfDay1[0]?.id ?? "");
  const [ex2, setEx2] = useState(exOfDay2[0]?.id ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-[560px] rounded-t-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
          ⛓ Dopplung hinzufügen
        </div>
        <div className="mb-1.5 text-base font-bold">
          Zwei Übungen manuell koppeln
        </div>
        <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
          Sätze &amp; Gewicht werden ab jetzt zwischen beiden synchronisiert.
        </p>

        <div className="mb-3 flex gap-2">
          <select
            value={day1}
            onChange={(e) => {
              setDay1(e.target.value);
              const first = exercises.find((ex) => ex.day_id === e.target.value);
              setEx1(first?.id ?? "");
            }}
            className="flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={ex1}
            onChange={(e) => setEx1(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {exOfDay1.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 flex gap-2">
          <select
            value={day2}
            onChange={(e) => {
              setDay2(e.target.value);
              const first = exercises.find((ex) => ex.day_id === e.target.value);
              setEx2(first?.id ?? "");
            }}
            className="flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
          <select
            value={ex2}
            onChange={(e) => setEx2(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {exOfDay2.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-3.5 text-sm font-semibold text-[var(--text-dim)]"
          >
            Abbrechen
          </button>
          <button
            onClick={() => {
              if (ex1 && ex2 && ex1 !== ex2) onConfirm(ex1, ex2);
            }}
            className="flex-1 rounded-xl bg-[var(--copper)] py-3.5 text-sm font-semibold text-[#1A1209]"
          >
            Koppeln
          </button>
        </div>
      </div>
    </div>
  );
}
