"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveMapsLink } from "@/lib/world/mapsLink";
import { ROUTING_GAP_MS, routeAlong, travelModeOf } from "@/lib/world/routing";
import {
  WORLD_PHOTO_BUCKET,
  type LatLng,
  type PhotoRef,
  type WorldPlace,
  type WorldRoute,
  type WorldStatus,
} from "@/lib/world/types";

type Result =
  | {
      ok: true;
      /** Links in which no coordinates were found. */
      unresolved?: number;
      /** Routes drawn as straight lines because no road course was found. */
      straight?: number;
    }
  | { error: string };

const STATUSES: WorldStatus[] = ["visited", "planned", "wish"];
const isLinkOrCoords = (s: string) => /^https?:\/\//i.test(s) || /^-?\d/.test(s);

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

function done(extra?: { unresolved: number; straight: number }): Result {
  revalidatePath("/world");
  revalidatePath("/hub");
  return { ok: true, ...extra };
}

export type CountryInput = {
  iso3: string;
  status: WorldStatus;
  dateFrom: string | null;
  dateTo: string | null;
  note: string | null;
  km: number | null;
  routes: { title: string; url: string }[];
  places: { title: string; url: string }[];
};

/**
 * Creates or updates a country entry. Coordinates for routes and places are
 * read from their Google-Maps links here (links that didn't change keep the
 * coordinates already stored). Photos are managed separately.
 */
export async function saveCountry(input: CountryInput): Promise<Result> {
  const { supabase, user } = await requireUser();

  if (!/^[A-Z]{3}$/.test(input.iso3)) return { error: "Unbekanntes Land." };
  if (!STATUSES.includes(input.status)) return { error: "Unbekannter Status." };

  const routeInputs = input.routes
    .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
    .filter((r) => r.url);
  const placeInputs = input.places
    .map((p) => ({ title: p.title.trim(), url: p.url.trim() }))
    .filter((p) => p.url);
  if ([...routeInputs, ...placeInputs].some((x) => !isLinkOrCoords(x.url))) {
    return { error: "Bitte einen Google-Maps-Link (https://…) oder Koordinaten eintragen." };
  }

  const { data: existing } = await supabase
    .from("world_countries")
    .select("*")
    .eq("user_id", user.id)
    .eq("iso3", input.iso3)
    .maybeSingle();

  const oldRoutes = ((existing?.routes as WorldRoute[] | null) ?? []).filter((r) => r.points);
  const oldPlaces = ((existing?.places as WorldPlace[] | null) ?? []).filter((p) => p.pos);
  let unresolved = 0;
  let straight = 0;

  // One after another: the routing service allows ~1 request per second.
  const routes: WorldRoute[] = [];
  let lastRoutingCall = 0;
  for (const r of routeInputs) {
    const old = oldRoutes.find((o) => o.url === r.url);
    const points = old?.points ?? (await resolveMapsLink(r.url));
    if (points.length < 2) {
      unresolved++;
      routes.push(r);
      continue;
    }
    const mode = travelModeOf(r.url);
    // Keep an already computed course; retry ones that failed before.
    if (old?.path && old.mode === mode) {
      routes.push({ ...r, points, mode, path: old.path, km: old.km });
      continue;
    }
    const wait = lastRoutingCall + ROUTING_GAP_MS - Date.now();
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    lastRoutingCall = Date.now();
    const routed = await routeAlong(points, mode);
    if (!routed) straight++;
    routes.push(routed ? { ...r, points, mode, ...routed } : { ...r, points, mode });
  }

  const places: WorldPlace[] = await Promise.all(
    placeInputs.map(async (p) => {
      const known = oldPlaces.find((o) => o.url === p.url)?.pos;
      const pos: LatLng | null = known ?? (await resolveMapsLink(p.url))[0] ?? null;
      if (!pos) unresolved++;
      return { ...p, pos };
    })
  );

  // `places` needs migration 0011; leave the column out when there is
  // nothing to write so everything else keeps working without it.
  const hadPlaces = ((existing?.places as WorldPlace[] | null) ?? []).length > 0;
  const { error } = await supabase.from("world_countries").upsert(
    {
      user_id: user.id,
      iso3: input.iso3,
      status: input.status,
      date_from: input.dateFrom || null,
      date_to: input.dateTo || null,
      note: input.note?.trim() || null,
      km: input.km != null && Number.isFinite(input.km) && input.km >= 0 ? input.km : null,
      routes,
      ...(places.length > 0 || hadPlaces ? { places } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,iso3" }
  );

  if (error) {
    if (/places/.test(error.message)) {
      return {
        error:
          "Für Orte fehlt noch die Migration supabase/migrations/0011_world_places.sql (im Supabase SQL Editor ausführen).",
      };
    }
    return { error: "Speichern fehlgeschlagen: " + error.message };
  }
  return done({ unresolved, straight });
}

export async function deleteCountry(iso3: string): Promise<Result> {
  const { supabase, user } = await requireUser();

  const { data: row } = await supabase
    .from("world_countries")
    .select("photos")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();

  const paths = ((row?.photos as PhotoRef[] | null) ?? []).flatMap((p) => filesOf(p));
  if (paths.length > 0) {
    await supabase.storage.from(WORLD_PHOTO_BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("world_countries")
    .delete()
    .eq("user_id", user.id)
    .eq("iso3", iso3);

  if (error) return { error: "Löschen fehlgeschlagen: " + error.message };
  return done();
}

async function updatePhotos(
  iso3: string,
  change: (photos: PhotoRef[], userId: string) => PhotoRef[] | { error: string }
): Promise<Result> {
  const { supabase, user } = await requireUser();

  const { data: row, error: readError } = await supabase
    .from("world_countries")
    .select("photos")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();
  if (readError || !row) return { error: "Land ist noch nicht eingetragen." };

  const next = change((row.photos as PhotoRef[] | null) ?? [], user.id);
  if (!Array.isArray(next)) return next;

  const { error } = await supabase
    .from("world_countries")
    .update({ photos: next, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("iso3", iso3);
  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };
  return done();
}

const filesOf = (p: PhotoRef) => (p.thumb ? [p.path, p.thumb] : [p.path]);

const mapsUrl = (pos: LatLng) => `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;

const validPos = (pos: unknown): pos is LatLng => {
  const p = pos as LatLng | null;
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
};

/**
 * Records already-uploaded photos (see lib/world/photoStore) on the entry.
 * `gps` is the position read from the photo's EXIF data, if it had one.
 */
export async function addPhotos(iso3: string, uploads: PhotoUpload[]): Promise<Result> {
  return updatePhotos(iso3, (photos, userId) => {
    const added = toPhotoRefs(uploads, `${userId}/${iso3}/`);
    return Array.isArray(added) ? [...photos, ...added] : added;
  });
}

type PhotoUpload = { path: string; thumb: string; w: number; h: number; gps: LatLng | null };

/** Checks that uploads sit in the user's own country folder and converts them. */
function toPhotoRefs(uploads: PhotoUpload[], prefix: string): PhotoRef[] | { error: string } {
  const bad = uploads.some(
    (u) => !u.path.startsWith(prefix) || (u.thumb !== "" && !u.thumb.startsWith(prefix))
  );
  if (bad) return { error: "Ungültiger Foto-Pfad." };
  return uploads.map((u) => ({
    path: u.path,
    w: u.w,
    h: u.h,
    ...(u.thumb ? { thumb: u.thumb } : {}),
    ...(validPos(u.gps) ? { loc: { lat: u.gps.lat, lng: u.gps.lng, url: mapsUrl(u.gps) } } : {}),
  }));
}

const isDate = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Photo import: having taken photos there means you've been there, so the
 * country is created or set to "visited", empty travel dates are filled
 * from the capture dates, and the uploaded photos are attached.
 */
export async function importCountryPhotos(
  iso3: string,
  uploads: PhotoUpload[],
  taken: { from: string | null; to: string | null }
): Promise<Result> {
  const { supabase, user } = await requireUser();
  if (!/^[A-Z]{3}$/.test(iso3)) return { error: "Unbekanntes Land." };

  const added = toPhotoRefs(uploads, `${user.id}/${iso3}/`);
  if (!Array.isArray(added)) return added;
  const from = isDate(taken.from) ? taken.from : null;
  const to = isDate(taken.to) ? taken.to : from;

  const { data: row } = await supabase
    .from("world_countries")
    .select("photos, date_from, date_to")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();

  const now = new Date().toISOString();
  const { error } = row
    ? await supabase
        .from("world_countries")
        .update({
          status: "visited",
          photos: [...((row.photos as PhotoRef[] | null) ?? []), ...added],
          // Only fill dates that are still empty — never overwrite a trip.
          ...(row.date_from || row.date_to ? {} : { date_from: from, date_to: to }),
          updated_at: now,
        })
        .eq("user_id", user.id)
        .eq("iso3", iso3)
    : await supabase.from("world_countries").insert({
        user_id: user.id,
        iso3,
        status: "visited",
        date_from: from,
        date_to: to,
        photos: added,
        routes: [],
        updated_at: now,
      });

  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };
  return done();
}

export async function removePhoto(iso3: string, path: string): Promise<Result> {
  let removed: PhotoRef | undefined;
  const result = await updatePhotos(iso3, (photos) => {
    removed = photos.find((p) => p.path === path);
    return photos.filter((p) => p.path !== path);
  });
  if ("ok" in result && removed) {
    const { supabase, user } = await requireUser();
    const files = filesOf(removed).filter((f) => f.startsWith(`${user.id}/`));
    if (files.length) await supabase.storage.from(WORLD_PHOTO_BUCKET).remove(files);
  }
  return result;
}

/**
 * Sets where a photo was taken: a Google-Maps link / "lat, lng" text, the
 * device position, or null to clear it.
 */
export async function setPhotoLocation(
  iso3: string,
  path: string,
  location: { link: string } | { position: LatLng } | null
): Promise<Result> {
  let loc: PhotoRef["loc"];

  if (location && "position" in location) {
    const { lat, lng } = location.position;
    if (!validPos(location.position)) return { error: "Ungültige Position." };
    loc = { lat, lng, url: mapsUrl({ lat, lng }) };
  } else if (location) {
    const link = location.link.trim();
    if (!isLinkOrCoords(link)) {
      return { error: "Bitte einen Google-Maps-Link (https://…) oder Koordinaten eintragen." };
    }
    const pos = (await resolveMapsLink(link))[0];
    if (!pos) return { error: "In diesem Link wurden keine Koordinaten gefunden." };
    loc = { ...pos, url: /^https?:\/\//i.test(link) ? link : mapsUrl(pos) };
  }

  return updatePhotos(iso3, (photos) =>
    photos.map((p) => {
      if (p.path !== path) return p;
      const { loc: _old, ...rest } = p; // eslint-disable-line @typescript-eslint/no-unused-vars
      return loc ? { ...rest, loc } : rest;
    })
  );
}
