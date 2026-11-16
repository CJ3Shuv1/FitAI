import type { LatLng } from "./types";

// Minimal EXIF reader for JPEGs: GPS position and capture date, without an
// extra dependency. Must run on the original file — the resized upload is
// re-encoded through a canvas and carries no metadata.

const HEAD_BYTES = 256 * 1024;

/**
 * Why a photo has no position:
 * - "no-exif":  no metadata at all (not a JPEG, e.g. HEIC/PNG, or the file was re-encoded)
 * - "no-gps":   metadata but no GPS block (camera location tags switched off)
 * - "redacted": GPS block present but blanked — Android does this when a
 *               browser reads photos through the gallery picker
 */
export type GpsMissing = "no-exif" | "no-gps" | "redacted";

export type PhotoMeta = {
  gps: LatLng | null;
  /** Capture date as YYYY-MM-DD (DateTimeOriginal, else DateTime). */
  takenOn: string | null;
  missing: GpsMissing | null;
};

function readRational(view: DataView, offset: number, little: boolean) {
  const num = view.getUint32(offset, little);
  const den = view.getUint32(offset + 4, little);
  return den === 0 ? NaN : num / den;
}

function readAscii(view: DataView, offset: number, length: number) {
  let s = "";
  for (let i = 0; i < length && offset + i < view.byteLength; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** "2025:08:14 13:22:05" → "2025-08-14" */
function exifDate(s: string): string | null {
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})/);
  if (!m || m[1] === "0000") return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseTiff(view: DataView, tiff: number): PhotoMeta {
  const little = view.getUint16(tiff) === 0x4949; // "II"
  if (view.getUint16(tiff + 2, little) !== 42) return { gps: null, takenOn: null, missing: "no-exif" };

  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  /** Visits the 12-byte entries of an IFD. */
  const entries = (ifd: number, visit: (tag: number, e: number) => void) => {
    const n = u16(ifd);
    for (let i = 0; i < n; i++) visit(u16(ifd + 2 + i * 12), ifd + 2 + i * 12);
  };
  /** ASCII value: inline if ≤ 4 bytes, else at an offset. */
  const ascii = (e: number) => {
    const count = u32(e + 4);
    return readAscii(view, count <= 4 ? e + 8 : tiff + u32(e + 8), count);
  };

  let gpsIfd = -1;
  let exifIfd = -1;
  let dateTime: string | null = null;
  entries(tiff + u32(tiff + 4), (tag, e) => {
    if (tag === 0x8825) gpsIfd = tiff + u32(e + 8);
    else if (tag === 0x8769) exifIfd = tiff + u32(e + 8);
    else if (tag === 0x0132) dateTime = exifDate(ascii(e));
  });

  let takenOn: string | null = null;
  if (exifIfd >= 0) {
    entries(exifIfd, (tag, e) => {
      if (tag === 0x9003) takenOn = exifDate(ascii(e));
    });
  }
  takenOn ??= dateTime;

  if (gpsIfd < 0) return { gps: null, takenOn, missing: "no-gps" };

  let latRef = "";
  let lngRef = "";
  let lat = NaN;
  let lng = NaN;
  const dms = (offset: number) =>
    readRational(view, offset, little) +
    readRational(view, offset + 8, little) / 60 +
    readRational(view, offset + 16, little) / 3600;

  entries(gpsIfd, (tag, e) => {
    if (tag === 1) latRef = String.fromCharCode(view.getUint8(e + 8));
    else if (tag === 3) lngRef = String.fromCharCode(view.getUint8(e + 8));
    else if (tag === 2) lat = dms(tiff + u32(e + 8));
    else if (tag === 4) lng = dms(tiff + u32(e + 8));
  });

  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;
  const valid =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  // Blanked coordinates (0/0, or no usable values) = removed on purpose.
  if (!valid || (lat === 0 && lng === 0)) return { gps: null, takenOn, missing: "redacted" };
  return {
    gps: { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 },
    takenOn,
    missing: null,
  };
}

/** GPS position, capture date and — if there's no position — why. */
export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  const none: PhotoMeta = { gps: null, takenOn: null, missing: "no-exif" };
  try {
    const view = new DataView(await file.slice(0, HEAD_BYTES).arrayBuffer());
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return none; // not a JPEG

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return none;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) return none; // image data starts: no EXIF
      const length = view.getUint16(offset + 2);
      // APP1 segment starting with "Exif\0\0"
      if (
        marker === 0xe1 &&
        offset + 10 <= view.byteLength &&
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0
      ) {
        return parseTiff(view, offset + 10);
      }
      offset += 2 + length;
    }
    return none;
  } catch {
    // Truncated or malformed EXIF — treat as "no metadata".
    return none;
  }
}

/** GPS position stored in a JPEG's EXIF data, or null if there is none. */
export async function readPhotoGps(file: Blob): Promise<LatLng | null> {
  return (await readPhotoMeta(file)).gps;
}
