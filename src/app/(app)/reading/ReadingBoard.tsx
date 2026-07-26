"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import { BOOK_SECTIONS, GENRE_COLORS, genreColor, type BookStatus } from "@/lib/bookColors";
import { createBook, deleteBook, updateBookStatus } from "./actions";

type SortMode = "title" | "author" | "year-desc" | "year-asc" | "genre";

const SPINE_HEIGHTS = [38, 46, 32, 50, 41, 36, 44, 30, 48, 43, 35];

export default function ReadingBoard({ initialBooks }: { initialBooks: Book[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BookStatus>("done");
  const [activeGenre, setActiveGenre] = useState("Alle");
  const [sortMode, setSortMode] = useState<SortMode>("title");
  const [showSheet, setShowSheet] = useState(false);

  const matches = (b: Book) =>
    activeGenre === "Alle" || (b.genres || []).includes(activeGenre);

  const usedGenres = useMemo(
    () =>
      [...new Set(initialBooks.flatMap((b) => b.genres || []))].sort((a, b) =>
        a.localeCompare(b, "de")
      ),
    [initialBooks]
  );

  const visible = useMemo(() => {
    const cmp = (a: unknown, b: unknown) => String(a).localeCompare(String(b), "de");
    return initialBooks
      .filter((b) => b.status === activeTab && matches(b))
      .sort((a, b) => {
        if (sortMode === "title") return cmp(a.title, b.title);
        if (sortMode === "author") return cmp(a.author, b.author);
        if (sortMode === "year-desc") return (b.year || 0) - (a.year || 0);
        if (sortMode === "year-asc") return (a.year || 0) - (b.year || 0);
        if (sortMode === "genre")
          return cmp((a.genres || [])[0], (b.genres || [])[0]) || cmp(a.title, b.title);
        return 0;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBooks, activeTab, activeGenre, sortMode]);

  const countFor = (status: BookStatus) =>
    initialBooks.filter((b) => b.status === status).length;

  return (
    <div className="pb-24">
      <h1 className="mb-2 text-4xl font-black leading-none tracking-tight">
        Mein Regal<span className="text-[var(--copper)]">.</span>
      </h1>
      <p className="mb-4 text-sm text-[var(--text-dim)]">
        <b className="font-semibold text-[var(--text)]">{countFor("done")}</b> durch ·{" "}
        <b className="font-semibold text-[var(--text)]">{countFor("open")}</b> offen ·{" "}
        <b className="font-semibold text-[var(--text)]">{countFor("plan")}</b> geplant
      </p>

      <div className="mb-1 flex h-14 items-end gap-[5px] overflow-hidden">
        {initialBooks.map((b, i) => (
          <span
            key={b.id}
            className="w-[9px] shrink-0 rounded-t-[3px] transition-opacity"
            style={{
              height: SPINE_HEIGHTS[i % SPINE_HEIGHTS.length],
              opacity: matches(b) ? 1 : 0.15,
              background: b.status === "done" ? genreColor((b.genres || [])[0]) : "transparent",
              boxShadow:
                b.status === "open"
                  ? `inset 0 0 0 2px ${genreColor((b.genres || [])[0])}`
                  : b.status === "plan"
                    ? "inset 0 0 0 2px var(--hairline)"
                    : undefined,
            }}
          />
        ))}
      </div>
      <div className="mb-5 h-1 rounded bg-[var(--steel)] opacity-50" />

      <div className="mb-3 flex gap-1 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
        {BOOK_SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 text-[13px] font-semibold ${
              activeTab === s.key
                ? "bg-[var(--copper)] text-[#1A1209]"
                : "text-[var(--text-faint)]"
            }`}
          >
            <span className="truncate">{s.label}</span>
            <span className="text-[11px] opacity-80">
              {initialBooks.filter((b) => b.status === s.key && matches(b)).length}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {["Alle", ...usedGenres].map((g) => (
          <button
            key={g}
            onClick={() => setActiveGenre(g)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold ${
              activeGenre === g
                ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
                : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--text-faint)]"
            }`}
          >
            {g !== "Alle" && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: genreColor(g) }}
              />
            )}
            {g}
          </button>
        ))}
      </div>

      <div className="mb-5 flex items-center gap-2">
        <label className="text-[13px] text-[var(--text-dim)]">Sortieren</label>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="flex-1 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm font-semibold"
        >
          <option value="title">Titel A–Z</option>
          <option value="author">Autor A–Z</option>
          <option value="year-desc">Jahr: neu zuerst</option>
          <option value="year-asc">Jahr: alt zuerst</option>
          <option value="genre">Genre</option>
        </select>
      </div>

      <div className="space-y-3">
        {visible.map((b) => (
          <BookCard
            key={b.id}
            book={b}
            onDelete={async () => {
              if (confirm(`„${b.title}“ aus dem Regal nehmen?`)) {
                await deleteBook(b.id);
                router.refresh();
              }
            }}
            onStatusChange={async (status) => {
              await updateBookStatus(b.id, status);
              router.refresh();
            }}
          />
        ))}
        {visible.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--hairline)] p-10 text-center text-[15px] text-[var(--text-faint)]">
            Hier steht noch nichts
            {activeGenre === "Alle" ? "" : ` unter „${activeGenre}“`}.
            <br />
            Unten rechts kommt was rein.
          </div>
        )}
      </div>

      <button
        onClick={() => setShowSheet(true)}
        className="fixed bottom-6 right-[max(1rem,calc(50%-16.5rem))] z-20 flex items-center gap-2 rounded-full bg-[var(--copper)] px-6 py-4 text-base font-black text-[#1A1209] shadow-[0_10px_26px_rgba(0,0,0,0.45)]"
      >
        ＋ Buch
      </button>

      {showSheet && (
        <AddBookSheet
          defaultStatus={activeTab}
          knownGenres={[...new Set([...usedGenres, ...Object.keys(GENRE_COLORS)])].sort((a, b) =>
            a.localeCompare(b, "de")
          )}
          onClose={() => setShowSheet(false)}
          onSaved={(status) => {
            setShowSheet(false);
            setActiveTab(status);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function BookCard({
  book,
  onDelete,
  onStatusChange,
}: {
  book: Book;
  onDelete: () => void;
  onStatusChange: (status: BookStatus) => void;
}) {
  const c = genreColor((book.genres || [])[0]);

  return (
    <article className="relative flex overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]">
      <div
        className="w-2.5 shrink-0"
        style={{
          background:
            book.status === "open"
              ? `repeating-linear-gradient(180deg, ${c} 0 8px, transparent 8px 14px)`
              : book.status === "plan"
                ? "var(--hairline)"
                : c,
        }}
      />
      <div className="min-w-0 flex-1 py-4 pl-4 pr-11">
        <h3 className="text-[19px] font-extrabold leading-tight tracking-tight">
          {book.title}
        </h3>
        <p className="mt-1 text-[13px] text-[var(--text-dim)]">
          {book.author}
          {book.year ? " · " + book.year : ""}
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {(book.genres || []).map((g) => (
            <span
              key={g}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#0E1826]"
              style={{ background: genreColor(g) }}
            >
              {g}
            </span>
          ))}
        </div>

        {book.blurb && (
          <p className="mt-3 text-[14.5px] text-[var(--text-dim)]">{book.blurb}</p>
        )}

        {(book.notes || []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {book.notes.map((n, i) => (
              <li key={i} className="relative pl-[18px] text-[14.5px] text-[var(--text-dim)]">
                <span
                  className="absolute left-0 top-[9px] h-0.5 w-2.5 rounded"
                  style={{ background: c }}
                />
                {n}
              </li>
            ))}
          </ul>
        )}

        {book.note && (
          <p className="mt-2.5 border-l-2 border-[var(--hairline)] pl-2.5 text-[13px] text-[var(--text-faint)]">
            {book.note}
          </p>
        )}

        <select
          value={book.status}
          onChange={(e) => onStatusChange(e.target.value as BookStatus)}
          className="mt-3 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--text-faint)]"
        >
          {BOOK_SECTIONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onDelete}
        aria-label={`${book.title} löschen`}
        className="absolute right-2 top-2 h-8 w-8 rounded-lg text-[var(--text-faint)]"
      >
        ✕
      </button>
    </article>
  );
}

function AddBookSheet({
  defaultStatus,
  knownGenres,
  onClose,
  onSaved,
}: {
  defaultStatus: BookStatus;
  knownGenres: string[];
  onClose: () => void;
  onSaved: (status: BookStatus) => void;
}) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<BookStatus>(defaultStatus);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [extraGenres, setExtraGenres] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const allGenres = [...new Set([...knownGenres, ...extraGenres])].sort((a, b) =>
    a.localeCompare(b, "de")
  );

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70">
      <div className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[22px] border-t border-[var(--hairline)] bg-[var(--bg)] p-4 pb-8">
        <div className="mx-auto mb-4 h-1 w-10 rounded bg-[var(--hairline)]" />
        <h2 className="mb-4 text-[22px] font-extrabold tracking-tight">Neues Buch</h2>

        <label className="mb-3.5 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
            Titel
          </span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="z. B. Der Insasse"
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--copper)]"
          />
        </label>

        <div className="mb-3.5 flex gap-2.5">
          <label className="flex-1">
            <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
              Autor
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Nachname"
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--copper)]"
            />
          </label>
          <label className="w-[100px] shrink-0">
            <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
              Jahr
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="2024"
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--copper)]"
            />
          </label>
        </div>

        <label className="mb-3.5 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
            Wohin?
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BookStatus)}
            className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-semibold"
          >
            {BOOK_SECTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="mb-3.5">
          <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
            Genres
          </span>
          <div className="flex flex-wrap gap-1.5">
            {allGenres.map((g) => (
              <button
                key={g}
                onClick={() =>
                  setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : [...p, g]))
                }
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                  picked.includes(g)
                    ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
                    : "border-[var(--hairline)] bg-[var(--surface)] text-[var(--text-faint)]"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: genreColor(g) }}
                />
                {g}
              </button>
            ))}
          </div>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const g = custom.trim();
              if (!g) return;
              setExtraGenres((x) => (x.includes(g) ? x : [...x, g]));
              setPicked((p) => (p.includes(g) ? p : [...p, g]));
              setCustom("");
            }}
            placeholder="Eigenes Genre + Enter"
            className="mt-2 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--copper)]"
          />
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-[13px] font-semibold text-[var(--text-dim)]">
            Was bleibt hängen? (eine Zeile pro Punkt)
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"Systeme schlagen Ziele.\n1 % besser pro Tag."}
            className="min-h-[88px] w-full resize-y rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 outline-none focus:border-[var(--copper)]"
          />
        </label>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] py-3.5 font-bold"
          >
            Abbrechen
          </button>
          <button
            disabled={saving}
            onClick={async () => {
              if (!title.trim()) return;
              setSaving(true);
              await createBook({
                status,
                title: title.trim(),
                author: author.trim(),
                year: year.trim() ? Number(year) : null,
                genres: picked,
                notes: notes
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              });
              onSaved(status);
            }}
            className="flex-1 rounded-2xl bg-[var(--copper)] py-3.5 font-bold text-[#1A1209] disabled:opacity-60"
          >
            {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
