import { createClient } from "@/lib/supabase/client";
import { resizeImage } from "./imageResize";
import { WORLD_PHOTO_BUCKET, type PhotoRef } from "./types";

/**
 * Client half of the photo storage: shrinks each picked image and uploads
 * it to the user's own folder. Returns the refs to record on the entry.
 */
export async function uploadCountryPhotos(iso3: string, files: File[]): Promise<PhotoRef[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");

  const refs: PhotoRef[] = [];
  for (const file of files) {
    const { blob, w, h } = await resizeImage(file);
    const path = `${user.id}/${iso3}/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from(WORLD_PHOTO_BUCKET)
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error("Upload fehlgeschlagen: " + error.message);
    refs.push({ path, w, h });
  }
  return refs;
}
