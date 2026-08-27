const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type JSTParts = {
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0=Sun
};

function jstParts(ms: number): JSTParts {
  const d = new Date(ms + JST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

function fromParts(p: JSTParts): string {
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function todayISO(): string {
  return fromParts(jstParts(Date.now()));
}

export function fromISO(iso: string): number {
  return new Date(`${iso}T00:00:00+09:00`).getTime();
}

export function toISO(ms: number): string {
  return fromParts(jstParts(ms));
}

/** 互換シグネチャ: 入力 Date (or ms) を JST 日付に */
export function toISODate(d: Date): string {
  return fromParts(jstParts(d.getTime()));
}

export function addDays(iso: string, days: number): string {
  return toISO(fromISO(iso) + days * 86400000);
}

export function startOfWeek(iso: string): string {
  const ms = fromISO(iso);
  const offset = (jstParts(ms).weekday + 6) % 7; // Monday-start
  return toISO(ms - offset * 86400000);
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function datePartsJST(iso: string): JSTParts {
  return jstParts(fromISO(iso));
}

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function fmtDateJP(iso: string): string {
  const p = datePartsJST(iso);
  return `${p.year}年${p.month}月${p.day}日`;
}

export function fmtRangeJP(startISO: string, endISO: string): string {
  const s = datePartsJST(startISO);
  const e = datePartsJST(endISO);
  if (s.month === e.month && s.year === e.year) return `${s.month}月${s.day}日 – ${e.day}日`;
  return `${s.month}月${s.day}日 – ${e.month}月${e.day}日`;
}

export function fmtMin(min: number | null): string {
  if (min == null) return "";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
