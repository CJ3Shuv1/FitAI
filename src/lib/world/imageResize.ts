const MAX_EDGE = 1600;
const THUMB_EDGE = 120;
const JPEG_QUALITY = 0.82;

function encode(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality: number
): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden");
  ctx.drawImage(bitmap, 0, 0, w, h);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, w, h }) : reject(new Error("Bild konnte nicht komprimiert werden"))),
      "image/jpeg",
      quality
    )
  );
}

/**
 * Downscales a picked/captured image so its longest edge is at most
 * MAX_EDGE px and re-encodes it as JPEG (respecting EXIF orientation), plus a
 * tiny thumbnail for the globe marker. Re-encoding drops all metadata, so
 * read anything needed from the original first (see ./exifGps).
 */
export async function resizeImage(
  file: File
): Promise<{ blob: Blob; w: number; h: number; thumb: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await encode(bitmap, MAX_EDGE, JPEG_QUALITY);
    const thumb = await encode(bitmap, THUMB_EDGE, 0.7);
    return { ...full, thumb: thumb.blob };
  } finally {
    bitmap.close();
  }
}
