import type { LatLng } from "./types";

// Reads coordinates out of Google-Maps links — no Maps API, no key. Short
// links (maps.app.goo.gl) are followed server-side to their long form first.

const GOOGLE_HOST = /(^|\.)google\.[a-z.]{2,6}$|(^|\.)goo\.gl$|(^|\.)g\.co$/i;
const NUM = String.raw`(-?\d{1,3}\.\d+)`;

const RE_PLAIN = new RegExp(String.raw`^${NUM}\s*[,;\s]\s*${NUM}$`);
const RE_WAYPOINT = new RegExp(`!1d${NUM}!2d${NUM}`, "g");
const RE_DIR_SEGMENT = new RegExp(String.raw`^${NUM},\+?${NUM}$`);
const RE_PIN = new RegExp(`!3d${NUM}!4d${NUM}`);
const RE_QUERY = new RegExp(
  String.raw`[?&](?:q|query|ll|center|origin|destination|saddr|daddr)=(?:loc:)?${NUM},\+?${NUM}`,
  "g"
);
const RE_AT = new RegExp(`@${NUM},${NUM}`);
const RE_BODY_CENTER = new RegExp(`center=${NUM}%2C${NUM}`);

function valid(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function push(out: LatLng[], lat: string, lng: string) {
  const p = { lat: parseFloat(lat), lng: parseFloat(lng) };
  if (!valid(p.lat, p.lng)) return;
  const last = out[out.length - 1];
  if (!last || last.lat !== p.lat || last.lng !== p.lng) out.push(p);
}

/** "41.33, 19.82" typed directly instead of a link. */
export function parsePlainCoords(text: string): LatLng | null {
  const m = text.trim().match(RE_PLAIN);
  if (!m) return null;
  const p = { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return valid(p.lat, p.lng) ? p : null;
}

/**
 * All coordinates found in a (long-form) Maps URL, most specific first:
 * directions waypoints, /dir/lat,lng segments, the place pin, query
 * parameters, and finally the viewport centre after "@".
 */
export function parseMapsCoords(rawUrl: string): LatLng[] {
  let url = rawUrl;
  try {
    url = decodeURIComponent(rawUrl);
  } catch {
    // keep the raw string
  }
  const out: LatLng[] = [];

  for (const m of url.matchAll(RE_WAYPOINT)) push(out, m[2], m[1]);
  if (out.length > 0) return out;

  const dir = url.match(/\/dir\/([^?@]*)/);
  if (dir) {
    for (const seg of dir[1].split("/")) {
      const m = seg.match(RE_DIR_SEGMENT);
      if (m) push(out, m[1], m[2]);
    }
    if (out.length > 0) return out;
  }

  const pin = url.match(RE_PIN);
  if (pin) push(out, pin[1], pin[2]);
  if (out.length > 0) return out;

  for (const m of url.matchAll(RE_QUERY)) push(out, m[1], m[2]);
  if (out.length > 0) return out;

  const at = url.match(RE_AT);
  if (at) push(out, at[1], at[2]);
  return out;
}

function isGoogleUrl(url: URL) {
  return (url.protocol === "https:" || url.protocol === "http:") && GOOGLE_HOST.test(url.hostname);
}

/**
 * Resolves a Maps link (or plain "lat, lng") to coordinates. Only Google
 * links are parsed or fetched, and redirects are followed by hand (a few
 * hops, Google hosts only) so a crafted link can't make the server call
 * anything else.
 */
export async function resolveMapsLink(input: string): Promise<LatLng[]> {
  const plain = parsePlainCoords(input);
  if (plain) return [plain];

  let current: URL;
  try {
    current = new URL(input.trim());
  } catch {
    return [];
  }

  for (let hop = 0; hop < 5; hop++) {
    if (!isGoogleUrl(current)) return [];
    const found = parseMapsCoords(current.toString());
    if (found.length > 0) return found;

    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) FitAI" },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current);
        continue;
      }
      // Last resort: the long URL sometimes only appears inside the page.
      const body = (await res.text()).slice(0, 400_000);
      const inBody = body.match(RE_AT) ?? body.match(RE_BODY_CENTER);
      const out: LatLng[] = [];
      if (inBody) push(out, inBody[1], inBody[2]);
      return out;
    } catch {
      return [];
    }
  }
  return [];
}
