import type { LatLng, TravelMode } from "./types";

// Turns the waypoints read from a Google-Maps link into the actual road
// course, using the free OpenStreetMap routing service run by FOSSGIS
// (the one behind openstreetmap.org — no key). It runs once when a route is
// saved; the result is stored, so showing the globe never calls it.
//
// Usage policy: light use only, at most ~1 request/second, identify the
// client. Callers must space requests (see ROUTING_GAP_MS).

const BASE = "https://routing.openstreetmap.de";
const PROFILE: Record<Exclude<TravelMode, "other">, string> = {
  car: "routed-car",
  bike: "routed-bike",
  foot: "routed-foot",
};
const MAX_POINTS = 1200;
const MAX_SNAP_M = 5000;
export const ROUTING_GAP_MS = 1100;

/** Travel mode chosen in Google Maps (data `!3e<n>` or `travelmode=`). */
export function travelModeOf(url: string): TravelMode {
  const data = url.match(/!3e(\d)/);
  if (data) return (["car", "bike", "foot"] as const)[Number(data[1])] ?? "other";
  const param = url.match(/[?&]travelmode=(\w+)/i)?.[1]?.toLowerCase();
  if (param === "bicycling") return "bike";
  if (param === "walking") return "foot";
  if (param === "transit") return "other";
  return "car"; // Google's default
}

/** Perpendicular distance² of p from segment a–b, in plain degree space. */
function segDist2(p: number[], a: number[], b: number[]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return x * x + y * y;
}

/** Douglas–Peucker (iterative, so long routes can't overflow the stack). */
function simplify(coords: number[][], tolerance: number): number[][] {
  if (coords.length <= 2) return coords;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const tol2 = tolerance * tolerance;
  const stack: [number, number][] = [[0, coords.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = segDist2(coords[i], coords[first], coords[last]);
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (index !== -1 && maxD > tol2) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

/** Thin out to at most MAX_POINTS, starting at ~30 m detail. */
function fit(coords: number[][]): number[][] {
  let tolerance = 0.0003;
  let out = simplify(coords, tolerance);
  while (out.length > MAX_POINTS) {
    tolerance *= 2;
    out = simplify(coords, tolerance);
  }
  return out;
}

/**
 * Road course and length through the given waypoints, or null when it
 * can't be computed (unsupported mode, no road connection, service down).
 */
export async function routeAlong(
  points: LatLng[],
  mode: TravelMode
): Promise<{ path: LatLng[]; km: number } | null> {
  if (mode === "other" || points.length < 2 || points.length > 25) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${BASE}/${PROFILE[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FitAI-travel-log/1.0 (personal travel journal)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: { distance: number; geometry: { coordinates: number[][] } }[];
      /** `distance` = metres the waypoint had to move to reach a road. */
      waypoints?: { distance: number }[];
    };
    const route = json.code === "Ok" ? json.routes?.[0] : undefined;
    if (!route || route.geometry.coordinates.length < 2 || route.distance < 50) return null;
    // A waypoint far from any road (sea, wilderness) gets snapped somewhere
    // unrelated — better a straight line than a wrong course.
    if ((json.waypoints ?? []).some((w) => w.distance > MAX_SNAP_M)) return null;
    const path = fit(route.geometry.coordinates).map(([lng, lat]) => ({
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    }));
    return { path, km: Math.round(route.distance / 100) / 10 };
  } catch {
    return null;
  }
}
