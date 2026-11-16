import isoCountries from "i18n-iso-countries";
import de from "i18n-iso-countries/langs/de.json";
import en from "i18n-iso-countries/langs/en.json";

isoCountries.registerLocale(de);
isoCountries.registerLocale(en);

export type Country = {
  iso3: string;
  nameDe: string;
  nameEn: string;
};

export const COUNTRIES: Country[] = Object.keys(isoCountries.getAlpha3Codes())
  .map((iso3) => ({
    iso3,
    nameDe: isoCountries.getName(iso3, "de") ?? iso3,
    nameEn: isoCountries.getName(iso3, "en") ?? iso3,
  }))
  .sort((a, b) => a.nameDe.localeCompare(b.nameDe, "de"));

const BY_ISO3 = new Map(COUNTRIES.map((c) => [c.iso3, c]));

export function countryName(iso3: string): string {
  return BY_ISO3.get(iso3)?.nameDe ?? iso3;
}

// Natural Earth leaves a few features without an ISO numeric id.
const NAME_FALLBACK: Record<string, string> = { Kosovo: "XKK" };

/** Maps a world-atlas feature (ISO numeric id + English name) to ISO alpha-3. */
export function iso3ForFeature(id: string | number | undefined, name?: string): string | null {
  if (id != null && id !== "") {
    const iso3 = isoCountries.numericToAlpha3(String(id).padStart(3, "0"));
    if (iso3) return iso3;
  }
  return (name && NAME_FALLBACK[name]) || null;
}

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

/** Search by German or English name (or ISO code); prefix matches first. */
export function searchCountries(query: string): Country[] {
  const q = fold(query.trim());
  if (!q) return COUNTRIES;
  const starts: Country[] = [];
  const contains: Country[] = [];
  for (const c of COUNTRIES) {
    const de = fold(c.nameDe);
    const en = fold(c.nameEn);
    if (de.startsWith(q) || en.startsWith(q) || c.iso3.toLowerCase() === q) starts.push(c);
    else if (de.includes(q) || en.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}
