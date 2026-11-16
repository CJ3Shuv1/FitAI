import type { LatLng } from "./types";

// Minimal EXIF reader: only pulls the GPS position out of a JPEG, so no
// extra dependency is needed. Must run on the original file — the resized
// upload is re-encoded through a canvas and carries no metadata.

const HEAD_BYTES = 256 * 1024;

function readRational(view: DataView, offset: number, little: boolean) {
  const num = view.getUint32(offset, little);
  const den = view.getUint32(offset + 4, little);
  return den === 0 ? NaN : num / den;
}

function parseGps(view: DataView, tiff: number): LatLng | null {
  const little = view.getUint16(tiff) === 0x4949; // "II"
  if (view.getUint16(tiff + 2, little) !== 42) return null;

  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);

  // IFD0 → GPSInfo pointer (tag 0x8825).
  const ifd0 = tiff + u32(tiff + 4);
  let gpsIfd = -1;
  for (let i = 0, n = u16(ifd0); i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (u16(e) === 0x8825) gpsIfd = tiff + u32(e + 8);
  }
  if (gpsIfd < 0) return null;

  let latRef = "";
  let lngRef = "";
  let lat = NaN;
  let lng = NaN;
  const dms = (offset: number) =>
    readRational(view, offset, little) +
    readRational(view, offset + 8, little) / 60 +
    readRational(view, offset + 16, little) / 3600;

  for (let i = 0, n = u16(gpsIfd); i < n; i++) {
    const e = gpsIfd + 2 + i * 12;
    const tag = u16(e);
    if (tag === 1) latRef = String.fromCharCode(view.getUint8(e + 8));
    else if (tag === 3) lngRef = String.fromCharCode(view.getUint8(e + 8));
    else if (tag === 2) lat = dms(tiff + u32(e + 8));
    else if (tag === 4) lng = dms(tiff + u32(e + 8));
  }

  if (latRef === "S") lat = -lat;
  if (lngRef === "W") lng = -lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Some cameras write 0/0 when they had no fix.
  if (lat === 0 && lng === 0) return null;
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}

/** GPS position stored in a JPEG's EXIF data, or null if there is none. */
export async function readPhotoGps(file: Blob): Promise<LatLng | null> {
  try {
    const view = new DataView(await file.slice(0, HEAD_BYTES).arrayBuffer());
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) return null;
      const marker = view.getUint8(offset + 1);
      if (marker === 0xda || marker === 0xd9) return null; // image data starts: no EXIF
      const length = view.getUint16(offset + 2);
      // APP1 segment starting with "Exif\0\0"
      if (
        marker === 0xe1 &&
        offset + 10 <= view.byteLength &&
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0
      ) {
        return parseGps(view, offset + 10);
      }
      offset += 2 + length;
    }
    return null;
  } catch {
    // Truncated or malformed EXIF — treat as "no position".
    return null;
  }
}
