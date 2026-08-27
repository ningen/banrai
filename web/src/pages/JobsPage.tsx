import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Job, JobStatus, Member, Service } from "../types";
import { fmtMin, parseISO } from "../date";
import { SvcChip } from "../components/bits";
import JobDrawer from "../components/JobDrawer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

const STATUS_COLORS = ["#64748b", "#2753e4", "#0e9f6e", "#c93f3f", "#2F6B45", "#A6402A", "#8A6BE0"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [addStatusOpen, setAddStatusOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (query?: string) => {
      setError(null);
      try {
        const querystr =
          query !== undefined
            ? query
              ? `?q=${encodeURIComponent(query)}`
              : ""
            : q
              ? `?q=${encodeURIComponent(q)}`
              : "";
        const [jobsRes, stRes, mem, svc] = await Promise.all([
          fetch(`/api/jobs${querystr}`),
          api<{ statuses: JobStatus[] }>("/api/statuses"),
          authClient.organization.listMembers(),
          api<{ services: Service[] }>("/api/services"),
        ]);
        const jobsBody = await jobsRes.json();
        setJobs(jobsBody.jobs ?? []);
        setStatuses(stRes.statuses);
        setMembers((mem.data as { members: Member[] } | undefined)?.members ?? []);
        setServices(svc.services);
      } catch (err) {
        setError(String((err as Error).message));
      }
    },
    [q],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const reloadKeep = useCallback(async () => {
    await load();
    if (selected) {
      const updated = jobs.find((j) => j.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [load, selected, jobs]);

  const byStatus = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const s of statuses) map.set(s.name, []);
    for (const j of jobs) {
      const list = map.get(j.status) ?? [];
      list.push(j);
      map.set(j.status, list);
    }
    return map;
  }, [jobs, statuses]);

  const moveStatus = async (jobId: string, status: string) => {
    try {
      await api(`/api/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      toast.error(String((err as Error).message));
    }
  };

  const addStatus = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const color = String(fd.get("color") ?? "#64748b");
    const done = fd.get("done") === "on";
    if (!name) return;
    try {
      await api("/api/statuses", { method: "POST", body: JSON.stringify({ name, color, done }) });
      toast.success(`ステータス「${name}」を作成しました`);
      setAddStatusOpen(false);
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const deleteStatus = async (s: JobStatus) => {
    if (!confirm(`ステータス「${s.name}」を削除しますか?`)) return;
    try {
      await api(`/api/statuses/${encodeURIComponent(s.name)}`, { method: "DELETE" });
      toast.success("削除しました");
      await load();
    } catch (err) {
      toast.error(String((err as Error).message));
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>作業一覧 (カンバン)</h2>
          <div className="sub">
            カードをドラッグ&ドロップでステータスを変更。検索は全期間対象です。
          </div>
        </div>
        <Button onClick={() => setAddStatusOpen(true)}>
          <Plus className="size-4" /> ステータスを追加
        </Button>
      </div>

      <div style={{ position: "relative", marginBottom: 14, maxWidth: 420 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
        <Input
          className="pl-9"
          placeholder="顧客名・住所・電話・メモで検索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div
        className="card"
        style={{
          padding: 12,
          display: "flex",
          gap: 10,
          overflowX: "auto",
          alignItems: "flex-start",
        }}
      >
        {statuses.map((s) => {
          const list = byStatus.get(s.name) ?? [];
          return (
            <div
              key={s.name}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData("text/plain");
                if (id) void moveStatus(id, s.name);
              }}
            >
              <div className="kanban-head">
                <span className="svc-dot" style={{ background: s.color }} />
                <b>{s.name}</b>
                <span className="num text-muted" style={{ fontSize: 12 }}>
                  {list.length}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  {!["下書き", "割当日", "完了", "キャンセル"].includes(s.name) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1"
                      onClick={() => deleteStatus(s)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </span>
              </div>
              <div className="kanban-body">
                {list.map((j) => (
                  <div
                    key={j.id}
                    className={`kanban-card ${j.status_done ? "dim" : ""}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", j.id)}
                    onClick={() => setSelected(j)}
                  >
                    <div className="kanban-time num">
                      {parseISO(j.scheduled_date).getMonth() + 1}/
                      {parseISO(j.scheduled_date).getDate()}（
                      {
                        ["日", "月", "火", "水", "木", "金", "土"][
                          parseISO(j.scheduled_date).getDay()
                        ]
                      }
                      ） {fmtMin(j.start_minute) || "時間未定"}
                    </div>
                    <div className="kanban-customer">{j.customer_name}</div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}
                    >
                      <SvcChip name={j.service_name} color={j.service_color} />
                      {j.phone && (
                        <span className="num muted" style={{ fontSize: 11.5 }}>
                          {j.phone}
                        </span>
                      )}
                    </div>
                    {j.assignments.length > 0 && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {j.assignments
                          .map((a) => members.find((m) => m.user.id === a.member_id)?.user.name)
                          .join("・")}
                      </div>
                    )}
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="muted" style={{ fontSize: 12, padding: "6px 2px" }}>
                    なし
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <JobDrawer
          job={selected}
          services={services}
          members={members}
          statuses={statuses}
          onClose={() => setSelected(null)}
          onChanged={() => void reloadKeep()}
        />
      )}

      <Dialog open={addStatusOpen} onOpenChange={setAddStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ステータスを追加</DialogTitle>
          </DialogHeader>
          <form onSubmit={addStatus} className="space-y-4">
            <div className="space-y-1.5">
              <Label>名前 *</Label>
              <Input name="name" required placeholder="ex: 見積待ち / 検査中" />
            </div>
            <div className="space-y-1.5">
              <Label>カラー</Label>
              <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                {STATUS_COLORS.map((c) => (
                  <label key={c} className="cursor-pointer">
                    <input
                      type="radio"
                      name="color"
                      value={c}
                      defaultChecked={c === STATUS_COLORS[0]}
                      className="sr-only"
                    />
                    <span
                      className="size-7 inline-block rounded-lg border border-line"
                      style={{ background: c }}
                    />
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="done" /> 完了扱いにする (カレンダーで薄表示)
            </label>
            {error && <p className="error">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddStatusOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit">作成</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
