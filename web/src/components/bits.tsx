import type { Job } from "../types";
import { Badge } from "./ui/badge";

const STATUS_LABEL: Record<Job["status"], string> = {
  draft: "下書き",
  assigned: "割当日",
  done: "完了",
  cancelled: "キャンセル",
};

const STATUS_CLASS: Record<Job["status"], string> = {
  draft: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--line-strong)]",
  assigned: "bg-[var(--indigo-10)] text-[var(--indigo)] border-[var(--indigo-20)]",
  done: "bg-[var(--done-soft)] text-[var(--done)] border-transparent",
  cancelled: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
};

export function StatusChip({ status }: { status: Job["status"] }) {
  return (
    <Badge variant="outline" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function SvcChip({ name, color }: { name: string | null; color?: string | null }) {
  return (
    <Badge variant="outline" className="gap-1.5 bg-background">
      <span className="size-2 rounded-full" style={{ background: color || "#64748b" }} />
      {name ?? "サービス未設定"}
    </Badge>
  );
}

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const initial = name.slice(0, 1);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[var(--paper)] border border-[var(--line-strong)] text-[var(--muted)] font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {initial}
    </span>
  );
}
