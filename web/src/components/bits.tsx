import { Badge } from "./ui/badge";

export function StatusChip({ label, color }: { label: string; color?: string | null }) {
  return (
    <Badge
      variant="outline"
      className="gap-1.5 bg-background"
      style={{
        borderColor: color ? `${color}55` : "var(--line-strong)",
        color: color ?? "var(--muted)",
      }}
    >
      <span className="size-2 rounded-full" style={{ background: color ?? "#8a8a85" }} />
      {label}
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
