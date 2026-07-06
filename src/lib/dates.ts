// Week/date helpers. Always returns all 7 weekdays (Mo–So) — the original
// Silverback app had reports of nutrition entries only working up to Friday;
// there is no weekday slicing anywhere here on purpose.

export const WEEKDAY_META = [
  { label: "Mo", full: "Montag" },
  { label: "Di", full: "Dienstag" },
  { label: "Mi", full: "Mittwoch" },
  { label: "Do", full: "Donnerstag" },
  { label: "Fr", full: "Freitag" },
  { label: "Sa", full: "Samstag" },
  { label: "So", full: "Sonntag" },
] as const;

function pad2(n: number) {
  return n < 10 ? "0" + n : "" + n;
}

export function dateKeyLocal(d: Date) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function shortDate(d: Date) {
  return d.getDate() + "." + (d.getMonth() + 1) + ".";
}

function getMonday(d: Date) {
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const m = new Date(d);
  m.setDate(d.getDate() - day);
  m.setHours(0, 0, 0, 0);
  return m;
}

export function weekMonday(weekOffset: number) {
  const m = getMonday(new Date());
  m.setDate(m.getDate() + weekOffset * 7);
  return m;
}

export type WeekDate = {
  key: string;
  label: string;
  full: string;
  date: Date;
};

// Returns all 7 days of the week (Monday through Sunday) for the given offset.
export function weekDates(weekOffset: number): WeekDate[] {
  const monday = weekMonday(weekOffset);
  return WEEKDAY_META.map((wd, i) => {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    return {
      key: dateKeyLocal(dt),
      label: wd.label,
      full: wd.full + " " + shortDate(dt),
      date: dt,
    };
  });
}

export function weekRangeLabel(weekOffset: number) {
  const dates = weekDates(weekOffset);
  return shortDate(dates[0].date) + "–" + shortDate(dates[6].date);
}
