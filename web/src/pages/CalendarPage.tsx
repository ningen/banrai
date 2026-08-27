import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Customer, Job, JobStatus, Member, Service } from "../types";
import { addDays, fmtDateJP, todayISO } from "../date";
import DaySchedule from "../components/DaySchedule";
import JobDrawer from "../components/JobDrawer";
import NewJobModal from "../components/NewJobModal";

type ModalState = {
  date: string;
  staffUserId: string | null;
  startMinute: number | null;
};

export default function CalendarPage() {
  const [date, setDate] = useState(() => todayISO());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statuses, setStatuses] = useState<JobStatus[]>([]);
  const [selected, setSelected] = useState<Job | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [svc, mem, custRes, stRes, jobsRes] = await Promise.all([
        api<{ services: Service[] }>("/api/services"),
        authClient.organization.listMembers(),
        api<{ customers: Customer[] }>("/api/customers").catch(() => ({ customers: [] })),
        api<{ statuses: JobStatus[] }>("/api/statuses"),
        fetch(`/api/jobs?from=${date}&to=${date}`),
      ]);
      const jobsBody = await jobsRes.json();
      setServices(svc.services);
      setMembers((mem.data as { members: Member[] } | undefined)?.members ?? []);
      setCustomers(custRes.customers);
      setStatuses(stRes.statuses);
      setJobs(jobsBody.jobs ?? []);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }, [date]);

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

  const weekday = useMemo(
    () => ["日", "月", "火", "水", "木", "金", "土"][new Date(`${date}T00:00:00`).getDay()],
    [date],
  );

  return (
    <div>
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button onClick={() => setDate((d) => addDays(d, -1))}>←</button>
          <button onClick={() => setDate(todayISO())}>今日</button>
          <button onClick={() => setDate((d) => addDays(d, 1))}>→</button>
        </div>
        <div className="cal-range num">
          {fmtDateJP(date)}（{weekday}）
        </div>
        <div className="muted num" style={{ marginLeft: "auto" }}>
          作業 {jobs.length} 件
        </div>
        <button
          className="primary"
          style={{ marginLeft: 6 }}
          onClick={() => setModal({ date, staffUserId: null, startMinute: null })}
        >
          + 作業を追加
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: "14px 12px" }}>
        <DaySchedule
          dateISO={date}
          jobs={jobs}
          members={members}
          onSelectJob={setSelected}
          onCreateAt={(d, staffUserId, startMinute) =>
            setModal({ date: d, staffUserId, startMinute })
          }
        />
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
      {modal && (
        <NewJobModal
          services={services}
          members={members}
          customers={customers}
          defaultDate={modal.date}
          defaultStaffId={modal.staffUserId}
          defaultStartMinute={modal.startMinute}
          onClose={() => setModal(null)}
          onCreated={() => void load()}
        />
      )}
    </div>
  );
}
