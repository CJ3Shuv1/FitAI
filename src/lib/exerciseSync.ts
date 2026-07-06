// Duplicate-exercise detection, ported from Silverback_Trainingsplan_1.html
// (normalizeName / buildGroups). Used server-side to decide whether an edited
// exercise should offer to sync sets/weight across days it also appears in.

const QUALIFIER_WORDS = new Set([
  "kh",
  "kurzhantel",
  "maschine",
  "kabel",
  "einarmig",
  "beidarmig",
  "langhantel",
  "rope",
  "seil",
]);

export function normalizeName(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.toLowerCase();
  s = s.replace(/\([^)]*\)/g, " ");
  s = s.replace(/[^a-zäöüß0-9\s/]/g, " ");
  let words = s.split(/[\s/]+/).filter(Boolean);
  words = words.filter((w) => !QUALIFIER_WORDS.has(w));
  words.sort();
  return words.join(" ");
}
