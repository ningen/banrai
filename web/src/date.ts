export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseISO(date: string): Date {
  return new Date(`${date}T00:00:00`);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const offset = (d.getDay() + 6) % 7; // Monday-start
  d.setDate(d.getDate() - offset);
  return toISO(d);
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

export function fmtDateJP(iso: string): string {
  return `${parseISO(iso).getFullYear()}年${parseISO(iso).getMonth() + 1}月${parseISO(iso).getDate()}日`;
}

export function fmtRangeJP(startISO: string, endISO: string): string {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (s.getMonth() === e.getMonth())
    return `${s.getMonth() + 1}月${s.getDate()}日 – ${e.getDate()}日`;
  return `${s.getMonth() + 1}月${s.getDate()}日 – ${e.getMonth() + 1}月${e.getDate()}日`;
}

export function fmtMin(min: number | null): string {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
