import type { Job } from "../types";

const STATUS_LABEL: Record<Job["status"], string> = {
  draft: "下書き",
  assigned: "割当日",
  done: "完了",
  cancelled: "キャンセル",
};

export function StatusChip({ status }: { status: Job["status"] }) {
  return <span className={`chip status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function SvcChip({ name, color }: { name: string | null; color?: string | null }) {
  return (
    <span className="chip">
      <span className="svc-dot" style={{ background: color || "#64748b" }} />
      {name ?? "サービス未設定"}
    </span>
  );
}

export function Avatar({ name, size = 20 }: { name: string; size?: number }) {
  const initial = name.slice(0, 1);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {initial}
    </span>
  );
}

export function getName(members: { user: { id: string; name: string } }[], id: string): string {
  return members.find((m) => m.user.id === id)?.user.name ?? "?";
}
