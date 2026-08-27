import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Job, Member, Service } from "../types";
import { addDays, fmtRangeJP, startOfWeek, todayISO } from "../date";
import WeekCalendar from "../components/WeekCalendar";
import JobDrawer from "../components/JobDrawer";
import NewJobModal from "../components/NewJobModal";

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayISO()));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [modalDate, setModalDate] = useState<string | null>(null);
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

  const reloadKeep = useCallback(async () => {
    await load();
    if (selected) {
      const updated = jobs.find((j) => j.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [load, selected, jobs]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>週間カレンダー</h2>
          <div className="sub">
            スタッフごとの作業割当。空きマスをクリックすると新規追加できます。
          </div>
        </div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-nav">
          <button onClick={() => setWeekStart((w) => addDays(w, -7))}>←</button>
          <button onClick={() => setWeekStart(startOfWeek(todayISO()))}>今日</button>
          <button onClick={() => setWeekStart((w) => addDays(w, 7))}>→</button>
        </div>
        <div className="cal-range">{fmtRangeJP(weekStart, weekEnd)}</div>
        <div style={{ marginLeft: "auto" }}>
          <button className="primary" onClick={() => setModalDate(todayISO())}>
            + 作業を追加
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 16, overflowX: "auto" }}>
        <WeekCalendar
          jobs={jobs}
          members={members}
          weekStartISO={weekStart}
          onSelectJob={setSelected}
          onCreateAt={(date) => setModalDate(date)}
        />
      </div>

      {selected && (
        <JobDrawer
          job={selected}
          services={services}
          members={members}
          onClose={() => setSelected(null)}
          onChanged={() => void reloadKeep()}
        />
      )}
      {modalDate && (
        <NewJobModal
          services={services}
          defaultDate={modalDate}
          onClose={() => setModalDate(null)}
          onCreated={() => void load()}
        />
      )}
    </div>
  );
}
