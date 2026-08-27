import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Job, Member, Service } from "../types";
import { addDays, fmtMin, parseISO, startOfWeek, todayISO } from "../date";
import { StatusChip, SvcChip } from "../components/bits";
import JobDrawer from "../components/JobDrawer";

const FILTERS: { key: Job["status"] | "all"; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "draft", label: "下書き" },
  { key: "assigned", label: "割当日" },
  { key: "done", label: "完了" },
  { key: "cancelled", label: "キャンセル" },
];

export default function JobsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [filter, setFilter] = useState<Job["status"] | "all">("all");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [svc, mem, jobsRes] = await Promise.all([
        api<{ services: Service[] }>("/api/services"),
        authClient.organization.listMembers(),
        fetch(`/api/jobs?from=${weekStart}&to=${weekEnd}`),
      ]);
      const jobsBody = await jobsRes.json();
      setServices(svc.services);
      setMembers((mem.data as { members: Member[] } | undefined)?.members ?? []);
      setJobs(jobsBody.jobs ?? []);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => jobs.filter((j) => filter === "all" || j.status === filter),
    [jobs, filter],
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>作業一覧</h2>
          <div className="sub">
            {weekStart} 〜 {weekEnd}
          </div>
        </div>
        <div className="cal-nav">
          <button onClick={() => setWeekStart((w) => addDays(w, -7))}>←</button>
          <button onClick={() => setWeekStart(startOfWeek(todayISO()))}>今日</button>
          <button onClick={() => setWeekStart((w) => addDays(w, 7))}>→</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`sm ${filter === f.key ? "primary" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>顧客</th>
              <th>サービス</th>
              <th>時間</th>
              <th>担当</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((j) => (
              <tr key={j.id} style={{ cursor: "pointer" }} onClick={() => setSelected(j)}>
                <td>
                  {parseISO(j.scheduled_date).getMonth() + 1}/{parseISO(j.scheduled_date).getDate()}
                  （
                  {["日", "月", "火", "水", "木", "金", "土"][parseISO(j.scheduled_date).getDay()]}
                  ）
                </td>
                <td>
                  <b>{j.customer_name}</b>
                  {j.address && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {j.address}
                    </div>
                  )}
                </td>
                <td>
                  <SvcChip name={j.service_name} color={j.service_color} />
                </td>
                <td>{fmtMin(j.start_minute) || "未定"}</td>
                <td>
                  {j.assignments.length === 0 ? (
                    <span
                      className="chip"
                      style={{ borderColor: "var(--indigo-20)", color: "var(--indigo)" }}
                    >
                      未割当
                    </span>
                  ) : (
                    j.assignments
                      .map((a) => members.find((m) => m.user.id === a.member_id)?.user.name)
                      .join("・")
                  )}
                </td>
                <td>
                  <StatusChip status={j.status} />
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 18 }}>
                  該当する作業がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <JobDrawer
          job={selected}
          services={services}
          members={members}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
