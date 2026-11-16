import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import type { GeometryCollection, Topology } from "topojson-specification";
import { iso3ForFeature } from "./countries";
import type { LatLng } from "./types";

// Country outlines (Natural Earth 1:50m via world-atlas, bundled — no
// runtime calls to other servers). Shared by the globe and by the photo
// import, which works out which country a photo was taken in.

export type CountryFeature = Feature<Geometry, { name: string; iso3: string | null }>;

let cache: Promise<CountryFeature[]> | null = null;

/** Loads and converts the outlines once per page. */
export function loadCountryFeatures(): Promise<CountryFeature[]> {
  cache ??= (async () => {
    const [topojson, atlas] = await Promise.all([
      import("topojson-client"),
      import("world-atlas/countries-50m.json"),
    ]);
    const topology = atlas.default as unknown as Topology<{
      countries: GeometryCollection<{ name: string }>;
    }>;
    const collection = topojson.feature(topology, topology.objects.countries) as FeatureCollection<
      Geometry,
      { name: string }
    >;
    return collection.features.map((f) => ({
      ...f,
      properties: { name: f.properties.name, iso3: iso3ForFeature(f.id, f.properties.name) },
    }));
  })();
  cache.catch(() => {
    cache = null; // allow a retry after a failed chunk load
  });
  return cache;
}

type Indexed = { iso3: string; polygons: Position[][][]; bbox: [number, number, number, number] };

function polygonsOf(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

let index: Promise<Indexed[]> | null = null;

function loadIndex(): Promise<Indexed[]> {
  index ??= loadCountryFeatures().then((features) =>
    features.flatMap((f) => {
      const iso3 = f.properties.iso3;
      if (!iso3) return [];
      const polygons = polygonsOf(f.geometry);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const poly of polygons)
        for (const [x, y] of poly[0]) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      return [{ iso3, polygons, bbox: [minX, minY, maxX, maxY] as [number, number, number, number] }];
    })
  );
  return index;
}

/** Even–odd ray casting over all rings of a polygon (holes cancel out). */
function inPolygon(x: number, y: number, rings: Position[][]) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Rough distance in km (equirectangular — fine for a few dozen km). */
function km(a: LatLng, x: number, y: number) {
  const dx = (x - a.lng) * Math.cos((a.lat * Math.PI) / 180) * 111.32;
  const dy = (y - a.lat) * 110.57;
  return Math.hypot(dx, dy);
}

/** Photos on a beach or a boat can land just outside the coarse outline. */
const COAST_TOLERANCE_KM = 25;

/**
 * States too small for the 1:50m outlines to place correctly (the Vatican
 * there is a box ~1 km west of the real one): centre + radius in km.
 */
const MICROSTATES: { iso3: string; centre: LatLng; radiusKm: number }[] = [
  { iso3: "VAT", centre: { lat: 41.9036, lng: 12.4525 }, radiusKm: 0.55 },
];

/** ISO alpha-3 of the country containing this point, or the nearest one within ~25 km. */
export async function countryAt(pos: LatLng): Promise<string | null> {
  const micro = MICROSTATES.find((m) => km(pos, m.centre.lng, m.centre.lat) <= m.radiusKm);
  if (micro) return micro.iso3;

  const countries = await loadIndex();
  const { lng: x, lat: y } = pos;

  // Enclaves (Vatican, San Marino, Lesotho…) sit inside a bigger country's
  // outline; when several match, the smallest one is the right answer.
  let hit: { iso3: string; area: number } | null = null;
  for (const c of countries) {
    const [minX, minY, maxX, maxY] = c.bbox;
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const area = (maxX - minX) * (maxY - minY);
    if (hit && area >= hit.area) continue;
    if (c.polygons.some((rings) => inPolygon(x, y, rings))) hit = { iso3: c.iso3, area };
  }
  if (hit) return hit.iso3;

  const margin = 0.5; // degrees, ≥ 25 km almost everywhere people travel
  let best: { iso3: string; d: number } | null = null;
  for (const c of countries) {
    const [minX, minY, maxX, maxY] = c.bbox;
    if (x < minX - margin || x > maxX + margin || y < minY - margin || y > maxY + margin) continue;
    for (const rings of c.polygons)
      for (const [px, py] of rings[0]) {
        const d = km(pos, px, py);
        if (d < (best?.d ?? COAST_TOLERANCE_KM)) best = { iso3: c.iso3, d };
      }
  }
  return best?.iso3 ?? null;
}
