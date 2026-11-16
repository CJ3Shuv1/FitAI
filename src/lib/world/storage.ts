import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WORLD_PHOTO_BUCKET,
  type CountryEntry,
  type PhotoRef,
  type WorldPlace,
  type WorldRoute,
  type WorldStatus,
} from "./types";

// Server-side read half of the "Meine Welt" storage layer (writes live in
// app/(app)/world/actions.ts, photo uploads in ./photoStore.ts). Everything
// that knows table/bucket names is in these three files, so swapping the
// backend later doesn't touch the UI.

type WorldRow = {
  iso3: string;
  status: WorldStatus;
  date_from: string | null;
  date_to: string | null;
  note: string | null;
  km: number | null;
  photos: PhotoRef[] | null;
  routes: WorldRoute[] | null;
  /** Missing until migration 0011 has run. */
  places?: WorldPlace[] | null;
};

export function rowToEntry(row: WorldRow): CountryEntry {
  return {
    iso3: row.iso3,
    status: row.status,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    note: row.note,
    km: row.km,
    photos: Array.isArray(row.photos) ? row.photos : [],
    routes: Array.isArray(row.routes) ? row.routes : [],
    places: Array.isArray(row.places) ? row.places : [],
  };
}

export type WorldData = {
  entries: CountryEntry[];
  /** Short-lived signed URLs, keyed by photo path. */
  photoUrls: Record<string, string>;
  /** True when the world_countries table doesn't exist yet (migration 0010). */
  setupMissing: boolean;
};

export async function loadWorld(supabase: SupabaseClient, userId: string): Promise<WorldData> {
  const { data, error } = await supabase
    .from("world_countries")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    return { entries: [], photoUrls: {}, setupMissing: true };
  }

  const entries = (data as WorldRow[]).map(rowToEntry);
  const paths = entries.flatMap((e) => e.photos.map((p) => p.path));
  const photoUrls: Record<string, string> = {};

  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(WORLD_PHOTO_BUCKET)
      .createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) photoUrls[s.path] = s.signedUrl;
    }
  }

  return { entries, photoUrls, setupMissing: false };
}
