"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  WORLD_PHOTO_BUCKET,
  type PhotoRef,
  type WorldRoute,
  type WorldStatus,
} from "@/lib/world/types";

type Result = { ok: true } | { error: string };

const STATUSES: WorldStatus[] = ["visited", "planned", "wish"];

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

function done(): Result {
  revalidatePath("/world");
  revalidatePath("/hub");
  return { ok: true };
}

export type CountryInput = {
  iso3: string;
  status: WorldStatus;
  dateFrom: string | null;
  dateTo: string | null;
  note: string | null;
  km: number | null;
  routes: WorldRoute[];
};

/** Creates or updates a country entry. Photos are managed separately. */
export async function saveCountry(input: CountryInput): Promise<Result> {
  const { supabase, user } = await requireUser();

  if (!/^[A-Z]{3}$/.test(input.iso3)) return { error: "Unbekanntes Land." };
  if (!STATUSES.includes(input.status)) return { error: "Unbekannter Status." };

  const routes = input.routes
    .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
    .filter((r) => r.url);
  if (routes.some((r) => !/^https?:\/\//i.test(r.url))) {
    return { error: "Routen-Links müssen mit http:// oder https:// beginnen." };
  }

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
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,iso3" }
  );

  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };
  return done();
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

/** Records already-uploaded photos (see lib/world/photoStore) on the entry. */
export async function addPhotos(iso3: string, refs: PhotoRef[]): Promise<Result> {
  const { supabase, user } = await requireUser();

  const prefix = `${user.id}/${iso3}/`;
  if (refs.some((r) => !r.path.startsWith(prefix))) {
    return { error: "Ungültiger Foto-Pfad." };
  }

  const { data: row, error: readError } = await supabase
    .from("world_countries")
    .select("photos")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();
  if (readError || !row) return { error: "Land ist noch nicht eingetragen." };

  const photos = [...((row.photos as PhotoRef[] | null) ?? []), ...refs];
  const { error } = await supabase
    .from("world_countries")
    .update({ photos, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("iso3", iso3);

  if (error) return { error: "Speichern fehlgeschlagen: " + error.message };
  return done();
}

export async function removePhoto(iso3: string, path: string): Promise<Result> {
  const { supabase, user } = await requireUser();

  if (!path.startsWith(`${user.id}/`)) return { error: "Ungültiger Foto-Pfad." };

  const { data: row } = await supabase
    .from("world_countries")
    .select("photos")
    .eq("user_id", user.id)
    .eq("iso3", iso3)
    .maybeSingle();
  if (!row) return { error: "Land ist nicht eingetragen." };

  const photos = ((row.photos as PhotoRef[] | null) ?? []).filter((p) => p.path !== path);
  const { error } = await supabase
    .from("world_countries")
    .update({ photos, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("iso3", iso3);
  if (error) return { error: "Löschen fehlgeschlagen: " + error.message };

  await supabase.storage.from(WORLD_PHOTO_BUCKET).remove([path]);
  return done();
}
