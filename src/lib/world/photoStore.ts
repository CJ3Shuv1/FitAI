import { createClient } from "@/lib/supabase/client";
import { readPhotoGps } from "./exifGps";
import { resizeImage } from "./imageResize";
import { WORLD_PHOTO_BUCKET, type LatLng } from "./types";

export type UploadedPhoto = { path: string; thumb: string; w: number; h: number; gps: LatLng | null };

/**
 * Client half of the photo storage: reads the GPS position from each picked
 * image (before resizing strips it), shrinks it, and uploads the photo plus a
 * small thumbnail to the user's own folder. Returns what to record on the entry.
 */
export async function uploadCountryPhotos(iso3: string, files: File[]): Promise<UploadedPhoto[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const bucket = supabase.storage.from(WORLD_PHOTO_BUCKET);
  const out: UploadedPhoto[] = [];
  for (const file of files) {
    const gps = await readPhotoGps(file);
    const { blob, w, h, thumb } = await resizeImage(file);
    const base = `${user.id}/${iso3}/${crypto.randomUUID()}`;
    const path = `${base}.jpg`;
    const thumbPath = `${base}_t.jpg`;

    const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error("Upload fehlgeschlagen: " + error.message);
    const { error: thumbError } = await bucket.upload(thumbPath, thumb, { contentType: "image/jpeg" });

    // A missing thumbnail only costs the small globe preview.
    out.push({ path, thumb: thumbError ? "" : thumbPath, w, h, gps });
  }
  return out;
}
