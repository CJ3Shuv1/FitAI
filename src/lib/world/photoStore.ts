import { createClient } from "@/lib/supabase/client";
import { readPhotoGps } from "./exifGps";
import { resizeImage } from "./imageResize";
import { WORLD_PHOTO_BUCKET, type LatLng } from "./types";

export type UploadedPhoto = { path: string; thumb: string; w: number; h: number; gps: LatLng | null };

const PARALLEL = 3;

async function currentUserId() {
  const supabase = createClient();
  // The session is local; the storage policy checks the folder server-side.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Nicht angemeldet");
  return { supabase, userId: session.user.id };
}

async function uploadOne(
  bucket: ReturnType<ReturnType<typeof createClient>["storage"]["from"]>,
  userId: string,
  iso3: string,
  file: File
): Promise<UploadedPhoto> {
  // Read the position before resizing — re-encoding drops all metadata.
  const gps = await readPhotoGps(file);
  const { blob, w, h, thumb } = await resizeImage(file);
  const base = `${userId}/${iso3}/${crypto.randomUUID()}`;
  const path = `${base}.jpg`;
  const thumbPath = `${base}_t.jpg`;

  const [full, small] = await Promise.all([
    bucket.upload(path, blob, { contentType: "image/jpeg" }),
    bucket.upload(thumbPath, thumb, { contentType: "image/jpeg" }),
  ]);
  if (full.error) throw new Error("Upload fehlgeschlagen: " + full.error.message);
  // A missing thumbnail only costs the small globe preview.
  return { path, thumb: small.error ? "" : thumbPath, w, h, gps };
}

/**
 * Client half of the photo storage: shrinks each picked image and uploads
 * it plus a small thumbnail to the user's own folder (3 at a time). Photos
 * that can't be read (e.g. HEIC) are skipped and counted in `failed`.
 */
export async function uploadPhotos(
  iso3: string,
  files: File[],
  onProgress?: () => void
): Promise<{ uploaded: UploadedPhoto[]; failed: number; lastError: string | null }> {
  const { supabase, userId } = await currentUserId();
  const bucket = supabase.storage.from(WORLD_PHOTO_BUCKET);
  const uploaded: UploadedPhoto[] = [];
  let failed = 0;
  let lastError: string | null = null;
  let next = 0;

  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      try {
        uploaded.push(await uploadOne(bucket, userId, iso3, file));
      } catch (err) {
        failed++;
        lastError = err instanceof Error ? err.message : "Upload fehlgeschlagen";
      }
      onProgress?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, files.length) }, worker));
  return { uploaded, failed, lastError };
}

/** Like uploadPhotos, but fails as a whole if any photo fails. */
export async function uploadCountryPhotos(iso3: string, files: File[]): Promise<UploadedPhoto[]> {
  const { uploaded, failed, lastError } = await uploadPhotos(iso3, files);
  if (failed > 0 && uploaded.length === 0) throw new Error(lastError ?? "Upload fehlgeschlagen");
  return uploaded;
}
