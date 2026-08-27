import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toISO, todayISO } from "../../src/date";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function fmtShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

type Props = {
  value: string;
  onChange: (iso: string) => void;
};

export default function DatePicker({ value, onChange }: Props) {
  const v = new Date(`${value}T00:00:00`);
  const [view, setView] = useState(() => new Date(v.getFullYear(), v.getMonth(), 1));

  const move = (delta: number) =>
    setView((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayISO();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(toISO(new Date(year, month, d)));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start font-normal num" type="button">
          {fmtShort(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <Button size="sm" variant="ghost" type="button" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="text-sm font-semibold">
            {year}年{month + 1}月
          </div>
          <Button size="sm" variant="ghost" type="button" onClick={() => move(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={cn("py-1", (i === 0 || i === 6) && "text-faint")}>
              {w}
            </div>
          ))}
          {cells.map((iso, i) =>
            iso === null ? (
              <div key={i} />
            ) : (
              <button
                key={iso}
                type="button"
                className={cn(
                  "rounded-md py-1 text-[12px] num",
                  iso === value && "bg-primary text-primary-foreground font-semibold",
                  iso === today && iso !== value && "ring-1 ring-primary font-semibold",
                  iso !== value && "hover:bg-accent",
                )}
                onClick={() => {
                  onChange(iso);
                }}
              >
                {Number(iso.slice(8, 10))}
              </button>
            ),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
