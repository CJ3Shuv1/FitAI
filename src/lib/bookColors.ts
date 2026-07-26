// Genre → colour mapping, ported from the standalone mein-regal tool so the
// shelf/spines/tags keep their identity inside FitAI.
export const GENRE_COLORS: Record<string, string> = {
  Finanzen: "#2FD6A5",
  Mindset: "#FF8A3D",
  Business: "#FFC93C",
  Produktivität: "#45A8FF",
  Roman: "#FF6B8A",
  "Coming-of-Age": "#A8DA3C",
  Horror: "#FF4D4D",
  Thriller: "#7C8BFF",
  Abenteuer: "#22D3EE",
  Sachbuch: "#9AA8BC",
  Klassiker: "#C792EA",
  Biografie: "#E8A87C",
  Krimi: "#FF9F68",
  Sport: "#5FE38B",
  Reise: "#3ED8D8",
  Geschichte: "#D9B26A",
  Psychologie: "#B48BFF",
};

const PALETTE = [
  "#2FD6A5",
  "#FF8A3D",
  "#FFC93C",
  "#45A8FF",
  "#FF6B8A",
  "#A8DA3C",
  "#22D3EE",
  "#C792EA",
];

// Stable hash so an unknown genre always gets the same colour.
export function genreColor(genre: string | undefined): string {
  if (!genre) return "#9AA8BC";
  if (GENRE_COLORS[genre]) return GENRE_COLORS[genre];
  let h = 0;
  for (const ch of String(genre)) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length];
}

export const BOOK_SECTIONS = [
  { key: "done", label: "Durchgelesen" },
  { key: "open", label: "Angefangen" },
  { key: "plan", label: "Als Nächstes" },
] as const;

export type BookStatus = (typeof BOOK_SECTIONS)[number]["key"];
