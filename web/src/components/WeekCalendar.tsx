import type { Member, Job } from "../types";
import { WEEKDAYS, isToday, parseISO, addDays, fmtMin } from "../date";
import { Avatar, SvcChip } from "./bits";

type Props = {
  jobs: Job[];
  members: Member[];
  weekStartISO: string;
  onSelectJob: (job: Job) => void;
  onCreateAt: (dateISO: string) => void;
};

const weekdays = WEEKDAYS;

export default function WeekCalendar({
  jobs,
  members,
  weekStartISO,
  onSelectJob,
  onCreateAt,
}: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));
  const unassigned = jobs.filter((j) => j.assignments.length === 0 && j.status !== "cancelled");
  const assigned = jobs.filter((j) => j.assignments.length > 0);

  const byStaffAndDay = new Map<string, { date: string; job: Job }[]>();
  for (const job of assigned) {
    for (const a of job.assignments) {
      const key = `${a.member_id}|${job.scheduled_date}`;
      const list = byStaffAndDay.get(key) ?? [];
      list.push({ date: job.scheduled_date, job });
      byStaffAndDay.set(key, list);
    }
  }

  return (
    <div style={{ overflowX: "auto", margin: "0 -8px", padding: "0 8px" }}>
      <div className="week-grid">
        {/* header row */}
        <div />
        {days.map((day) => {
          const d = parseISO(day);
          const wd = d.getDay();
          return (
            <div
              key={day}
              className={`wk-day-head ${wd === 0 || wd === 6 ? "weekend" : ""} ${isToday(day) ? "today" : ""}`}
            >
              {weekdays[(wd + 6) % 7]} <span className="dnum">{d.getDate()}</span>
            </div>
          );
        })}

        {/* unassigned lane */}
        <div className="wk-staff">
          <b style={{ color: "var(--indigo)" }}>未割当</b>
        </div>
        <div className="unassigned-lane" style={{ gridColumn: "2 / 9" }}>
          {unassigned.length === 0 && <span>全作業が割当済みです</span>}
          {unassigned.map((job) => (
            <span key={job.id} style={{ cursor: "pointer" }} onClick={() => onSelectJob(job)}>
              <SvcChip name={job.service_name} color={job.service_color} />
              <b style={{ margin: "0 4px" }}>{job.customer_name}</b>
              <span>
                {parseISO(job.scheduled_date).getDate()}日 {fmtMin(job.start_minute)}
              </span>
            </span>
          ))}
        </div>

        {/* staff rows */}
        {members.map((member) => (
          <Row
            key={member.id}
            member={member}
            days={days}
            byStaffAndDay={byStaffAndDay}
            onSelectJob={onSelectJob}
            onCreateAt={onCreateAt}
          />
        ))}
        {members.length === 0 && (
          <div className="muted" style={{ gridColumn: "2 / 9", padding: "8px 2px" }}>
            スタッフがいません。「スタッフ」からメンバーを招待してください。
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  member,
  days,
  byStaffAndDay,
  onSelectJob,
  onCreateAt,
}: {
  member: Member;
  days: string[];
  byStaffAndDay: Map<string, { date: string; job: Job }[]>;
  onSelectJob: (job: Job) => void;
  onCreateAt: (dateISO: string) => void;
}) {
  return (
    <>
      <div className="wk-staff">
        <Avatar name={member.user.name} />
        {member.user.name}
      </div>
      {days.map((day) => {
        const cells =
          byStaffAndDay.get(`${member.user.id}|${day}`)?.filter((c) => c.date === day) ?? [];
        return (
          <div
            key={day}
            className={`wk-cell ${isToday(day) ? "today" : ""} ${cells.length === 0 ? "empty" : ""}`}
            onClick={() => (cells.length === 0 ? onCreateAt(day) : undefined)}
          >
            {cells.map(({ job }) => (
              <JobBlock job={job} key={job.id} onSelect={onSelectJob} />
            ))}
          </div>
        );
      })}
    </>
  );
}

function JobBlock({ job, onSelect }: { job: Job; onSelect: (job: Job) => void }) {
  const color = job.service_color || "var(--svc-default)";
  const done = job.status === "done";
  return (
    <div
      className={`job-blk ${done ? "done" : ""} ${job.status === "cancelled" ? "cancelled" : ""}`}
      style={{ ["--svc-default" as string]: color }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(job);
      }}
      title={job.customer_name}
    >
      <span className="cn">{job.customer_name}</span>
      <span className="tm">
        {fmtMin(job.start_minute) || "未定"} {job.notes ? "・ " + job.notes.slice(0, 8) : ""}
      </span>
    </div>
  );
}
