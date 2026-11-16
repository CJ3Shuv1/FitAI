"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveMapsLink } from "@/lib/world/mapsLink";
import {
  WORLD_PHOTO_BUCKET,
  type LatLng,
  type PhotoRef,
  type WorldPlace,
  type WorldRoute,
  type WorldStatus,
} from "@/lib/world/types";

type Result = { ok: true; unresolved?: number } | { error: string };

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

function done(extra?: { unresolved: number }): Result {
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

  const routes: WorldRoute[] = await Promise.all(
    routeInputs.map(async (r) => {
      const known = oldRoutes.find((o) => o.url === r.url)?.points;
      const points = known ?? (await resolveMapsLink(r.url));
      if (points.length < 2) {
        unresolved++;
        return r;
      }
      return { ...r, points };
    })
  );

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
  return done({ unresolved });
}

export async function deleteCountry(iso3: string): Promise<Result> {
  const { supabase, user } = await requireUser();

  const { data: row } = await supabase
    .from("world_countries")
    .select("photos")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();

  const paths = ((row?.photos as PhotoRef[] | null) ?? []).map((p) => p.path);
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

/** Records already-uploaded photos (see lib/world/photoStore) on the entry. */
export async function addPhotos(iso3: string, refs: PhotoRef[]): Promise<Result> {
  return updatePhotos(iso3, (photos, userId) => {
    const prefix = `${userId}/${iso3}/`;
    if (refs.some((r) => !r.path.startsWith(prefix))) return { error: "Ungültiger Foto-Pfad." };
    return [...photos, ...refs.map((r) => ({ path: r.path, w: r.w, h: r.h }))];
  });
}

export async function removePhoto(iso3: string, path: string): Promise<Result> {
  const result = await updatePhotos(iso3, (photos) => photos.filter((p) => p.path !== path));
  if ("ok" in result) {
    const { supabase, user } = await requireUser();
    if (path.startsWith(`${user.id}/`)) {
      await supabase.storage.from(WORLD_PHOTO_BUCKET).remove([path]);
    }
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
    if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return { error: "Ungültige Position." };
    loc = { lat, lng, url: `https://www.google.com/maps?q=${lat},${lng}` };
  } else if (location) {
    const link = location.link.trim();
    if (!isLinkOrCoords(link)) {
      return { error: "Bitte einen Google-Maps-Link (https://…) oder Koordinaten eintragen." };
    }
    const pos = (await resolveMapsLink(link))[0];
    if (!pos) return { error: "In diesem Link wurden keine Koordinaten gefunden." };
    loc = {
      ...pos,
      url: /^https?:\/\//i.test(link) ? link : `https://www.google.com/maps?q=${pos.lat},${pos.lng}`,
    };
  }

  return updatePhotos(iso3, (photos) =>
    photos.map((p) => {
      if (p.path !== path) return p;
      const { path: pPath, w, h } = p;
      return loc ? { path: pPath, w, h, loc } : { path: pPath, w, h };
    })
  );
}
