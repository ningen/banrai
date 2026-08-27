import { fmtMin } from "../date";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export const TIME_START = 360; // 6:00
export const TIME_END = 1260; // 21:00
export const TIME_STEP = 30;

const timeOptions = Array.from(
  { length: (TIME_END - TIME_START) / TIME_STEP + 1 },
  (_, i) => TIME_START + i * TIME_STEP,
);

function snap(minute: number): number {
  const m = Math.round((minute - TIME_START) / TIME_STEP) * TIME_STEP + TIME_START;
  return Math.max(TIME_START, Math.min(TIME_END, m));
}

export function TimeSelect({
  value,
  onValueChange,
  className,
  disabled,
}: {
  value: number | null;
  onValueChange: (minute: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  const snapped = value != null ? snap(value) : TIME_START;
  return (
    <Select
      value={String(snapped)}
      onValueChange={(v) => onValueChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {timeOptions.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {fmtMin(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const DURATION_MIN = 30;
export const DURATION_MAX = 720; // 12h

const durationOptions = Array.from(
  { length: (DURATION_MAX - DURATION_MIN) / 30 + 1 },
  (_, i) => DURATION_MIN + i * 30,
);

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}分`;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

export function DurationSelect({
  value,
  onValueChange,
  className,
  disabled,
}: {
  value: number;
  onValueChange: (min: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  const snapped = Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(value / 30) * 30));
  return (
    <Select
      value={String(snapped)}
      onValueChange={(v) => onValueChange(Number(v))}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {durationOptions.map((m) => (
          <SelectItem key={m} value={String(m)}>
            {fmtDuration(m)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
