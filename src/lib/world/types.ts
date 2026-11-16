export type WorldStatus = "visited" | "planned" | "wish";

export type LatLng = { lat: number; lng: number };

export type PhotoRef = {
  /** Path inside the private "world-photos" bucket: <user_id>/<iso3>/<uuid>.jpg */
  path: string;
  w: number;
  h: number;
  /** Where the photo was taken; drawn as a marker on the globe. */
  loc?: LatLng & { url: string };
};

export type WorldRoute = {
  title: string;
  url: string;
  /** Waypoints read from the Google-Maps link; absent if none were found. */
  points?: LatLng[];
};

export type WorldPlace = {
  title: string;
  url: string;
  /** Null when no coordinates could be read from the link. */
  pos: LatLng | null;
};

export type CountryEntry = {
  iso3: string;
  status: WorldStatus;
  dateFrom: string | null;
  dateTo: string | null;
  note: string | null;
  km: number | null;
  photos: PhotoRef[];
  routes: WorldRoute[];
  places: WorldPlace[];
};

export const WORLD_STATUSES: { key: WorldStatus; label: string; color: string }[] = [
  { key: "visited", label: "Besucht", color: "#3F8FE8" },
  { key: "planned", label: "Geplant", color: "#F2B21B" },
  { key: "wish", label: "Wunsch", color: "#8B95A1" },
];

export function statusMeta(status: WorldStatus) {
  return WORLD_STATUSES.find((s) => s.key === status)!;
}

/** 193 UN member states + 2 observer states — the base for "% der Welt". */
export const WORLD_COUNTRY_TOTAL = 195;

export const WORLD_PHOTO_BUCKET = "world-photos";
