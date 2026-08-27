import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Job, JobStatus, Member, Service } from "../types";
import { datePartsJST, fmtMin } from "../date";
import { SvcChip } from "../components/bits";
import JobDrawer from "../components/JobDrawer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { cn } from "@/lib/utils";
import SearchBox from "../components/SearchBox";

const STATUS_COLORS = ["#64748b", "#2753e4", "#0e9f6e", "#c93f3f", "#2F6B45", "#A6402A", "#8A6BE0"];

function KanbanCard({
  job,
  members,
  statuses,
  onOpen,
  onMove,
}: {
  job: Job;
  members: Member[];
  statuses: JobStatus[];
  onOpen: () => void;
  onMove: (status: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { job },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("kanban-card", job.status_done && "dim")}
      onClick={onOpen}
    >
      <div className="flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <div className="kanban-time num">
            {datePartsJST(job.scheduled_date).month}/{datePartsJST(job.scheduled_date).day}（
            {["日", "月", "火", "水", "木", "金", "土"][datePartsJST(job.scheduled_date).weekday]}）{" "}
            {fmtMin(job.start_minute) || "時間未定"}
          </div>
          <div className="kanban-customer">{job.customer_name}</div>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 -mr-1 -mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="end">
            {statuses.map((s) => (
              <button
                key={s.name}
                type="button"
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-accent"
                onClick={() => {
                  onMove(s.name);
                }}
              >
                <span className="size-2 rounded-full" style={{ background: s.color }} />
                <span className="flex-1">{s.name}</span>
                {job.status === s.name && <Check className="size-3.5 text-primary" />}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <SvcChip name={job.service_name} color={job.service_color} />
        {job.phone && (
          <span className="num muted" style={{ fontSize: 11.5 }}>
            {job.phone}
          </span>
        )}
      </div>
      {job.assignments.length > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>
          {job.assignments
            .map((a) => members.find((m) => m.user.id === a.member_id)?.user.name)
            .join("・")}
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  jobs,
  members,
  statuses,
  onOpenJob,
  onMove,
  onDelete,
}: {
  status: JobStatus;
  jobs: Job[];
  members: Member[];
  statuses: JobStatus[];
  onOpenJob: (job: Job) => void;
  onMove: (jobId: string, status: string) => void;
  onDelete: (status: JobStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.name });
  const deletable = !["下書き", "割当日", "完了", "キャンセル"].includes(status.name);

  return (
    <div ref={setNodeRef} className={cn("kanban-col", isOver && "ring-2 ring-primary/60")}>
      <div className="kanban-head">
        <span className="svc-dot" style={{ background: status.color }} />
        <b>{status.name}</b>
        <span className="num text-muted" style={{ fontSize: 12 }}>
          {jobs.length}
        </span>
        <span style={{ marginLeft: "auto" }}>
          {deletable && (
            <Button size="sm" variant="ghost" className="h-6 px-1" onClick={() => onDelete(status)}>
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </span>
      </div>
      <div className="kanban-body">
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          {jobs.map((j) => (
            <KanbanCard
              key={j.id}
              job={j}
              members={members}
              statuses={statuses}
              onOpen={() => onOpenJob(j)}
              onMove={(s) => onMove(j.id, s)}
            />
          ))}
        </SortableContext>
        {jobs.length === 0 && (
          <div className="muted" style={{ fontSize: 12, padding: "6px 2px" }}>
            なし
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Job | null>(null);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [addStatusOpen, setAddStatusOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.position ?? 0) - (b.position ?? 0) ||
          a.scheduled_date.localeCompare(b.scheduled_date) ||
          (a.start_minute ?? 0) - (b.start_minute ?? 0),
      );
    }
    return map;
  }, [jobs, statuses]);

  const moveStatus = useCallback(
    async (jobId: string, status: string) => {
      if (!status) return;
      try {
        await api(`/api/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify({ status }) });
        await load();
      } catch (err) {
        toast.error(String((err as Error).message));
      }
    },
    [load],
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveJob(null);
      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const moved = jobs.find((j) => j.id === activeId);
      if (!moved) return;

      const isStatusOver = statuses.some((s) => s.name === overId);
      let targetCol: string;
      let insertIndex: number;
      if (isStatusOver) {
        targetCol = overId;
        insertIndex = -1; // 末尾に挿入
      } else {
        const overJob = jobs.find((j) => j.id === overId);
        if (!overJob) return;
        targetCol = overJob.status;
        const colJobs = jobs
          .filter((j) => j.status === targetCol && j.id !== activeId)
          .toSorted(
            (a, b) =>
              (a.position ?? 0) - (b.position ?? 0) ||
              a.scheduled_date.localeCompare(b.scheduled_date) ||
              (a.start_minute ?? 0) - (b.start_minute ?? 0),
          );
        const overIdx = colJobs.findIndex((j) => j.id === overId);
        const overRectTop = (over as { rect?: { top: number; height: number } }).rect?.top;
        const activeTop = active.rect.current.translated?.top;
        const insertAfter =
          overRectTop !== undefined &&
          activeTop !== undefined &&
          activeTop > overRectTop + ((over as { rect?: { height: number } }).rect?.height ?? 0) / 2
            ? 1
            : 0;
        insertIndex = Math.min(colJobs.length, Math.max(0, overIdx + insertAfter));
      }

      const targetColJobs = jobs.filter((j) => j.status === targetCol && j.id !== activeId);
      const nextOrder = [...(targetCol.trim() ? targetColJobs : [])];
      const movedIn = { ...moved, status: targetCol };
      if (insertIndex === -1) nextOrder.push(movedIn);
      else nextOrder.splice(insertIndex, 0, movedIn);

      try {
        await Promise.all(
          nextOrder.map((j, i) => {
            const body: Record<string, unknown> = { position: i * 10 };
            if (j.id === activeId && moved.status !== targetCol) body.status = targetCol;
            return api(`/api/jobs/${j.id}`, { method: "PATCH", body: JSON.stringify(body) });
          }),
        );
        await load();
      } catch (err) {
        toast.error(String((err as Error).message));
      }
    },
    [jobs, statuses, load],
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const job = jobs.find((j) => j.id === String(event.active.id));
      setActiveJob(job ?? null);
    },
    [jobs],
  );

  const onDragCancel = useCallback(() => setActiveJob(null), []);

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

  const confirmDeleteStatus = async () => {
    if (!deleteTarget) return;
    try {
      await api(`/api/statuses/${encodeURIComponent(deleteTarget.name)}`, { method: "DELETE" });
      toast.success("削除しました");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(String((err as Error).message));
      setDeleteTarget(null);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>作業一覧 (カンバン)</h2>
          <div className="sub">
            カードをドラッグして移動、または「⋯」からステータスを選択。検索は全期間対象です。
          </div>
        </div>
        <Button onClick={() => setAddStatusOpen(true)}>
          <Plus className="size-4" /> ステータスを追加
        </Button>
      </div>

      <SearchBox
        className="mb-4 max-w-105"
        placeholder="顧客名・住所・電話・メモで検索…"
        value={q}
        onChange={setQ}
        onEnter={() => void load(q)}
      />

      {error && <p className="error">{error}</p>}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          className="card"
          style={{
            padding: 12,
            display: "flex",
            gap: 10,
            overflowX: "auto",
            alignItems: "stretch",
          }}
        >
          {statuses.map((s) => (
            <KanbanColumn
              key={s.name}
              status={s}
              jobs={byStatus.get(s.name) ?? []}
              members={members}
              statuses={statuses}
              onOpenJob={setSelected}
              onMove={(jobId, next) => void moveStatus(jobId, next)}
              onDelete={(st) => setDeleteTarget(st)}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 160 }}>
          {activeJob && (
            <div
              className="kanban-card"
              style={{ boxShadow: "var(--shadow-2)", cursor: "grabbing" }}
            >
              <div className="kanban-time num">
                {fmtMin(activeJob.start_minute) || "時間未定"}・{activeJob.customer_name}
              </div>
              <div className="kanban-customer">{activeJob.customer_name}</div>
              <SvcChip name={activeJob.service_name} color={activeJob.service_color} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ステータス「{deleteTarget?.name}」を削除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            削除しますか? 使用中の作業がある場合は削除できません (キャンセル扱いの作業は除く)。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button variant="destructive" onClick={() => void confirmDeleteStatus()}>
              削除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
