import { useEffect, useState } from "react";
import type { Job, Member } from "../types";
import { isToday, fmtMin } from "../date";

const DAY_START = 360; // 6:00
const DAY_END = 1260; // 21:00
const HOUR_H = 48; // px per hour

function minutesNow(): number {
  return (Date.now() / 60000) % 1440;
}

type Block = {
  job: Job;
  start: number;
  end: number;
  lane: number;
  laneCount: number;
};

function layoutBlocks(jobs: Job[]): Block[] {
  const blocks = jobs
    .map((job) => {
      const start = job.start_minute ?? 540;
      const end = Math.min(DAY_END, start + Math.max(job.duration_min, 30));
      return { job, start, end, lane: 0, laneCount: 1 };
    })
    .toSorted((a, b) => a.start - b.start);
  const lanes: number[] = [];
  for (const b of blocks) {
    let lane = lanes.findIndex((lastEnd) => lastEnd <= b.start);
    if (lane === -1) {
      lane = lanes.length;
      lanes.push(-Infinity);
    }
    lanes[lane] = b.end;
    b.lane = lane;
  }
  const laneCount = Math.max(lanes.length, 1);
  for (const blk of blocks) blk.laneCount = laneCount;
  return blocks;
}

type Props = {
  dateISO: string;
  jobs: Job[];
  members: Member[];
  onSelectJob: (job: Job) => void;
  onCreateAt: (dateISO: string, staffUserId: string | null, startMinute: number | null) => void;
};

export default function DaySchedule({ dateISO, jobs, members, onSelectJob, onCreateAt }: Props) {
  const totalHours = (DAY_END - DAY_START) / 60;
  const bodyH = totalHours * HOUR_H;
  const hourLabels = Array.from({ length: totalHours }, (_, i) => DAY_START + i * 60);
  const slotMins = Array.from({ length: (DAY_END - DAY_START) / 30 }, (_, i) => DAY_START + i * 30);

  const unassignedJobs = jobs.filter((j) => j.assignments.length === 0);
  const unassignedBlocks = layoutBlocks(unassignedJobs);

  // oxlint-disable-next-line react/purity -- now-line position computed once per day via state
  const [nowTop, setNowTop] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday(dateISO)) {
      setNowTop(null);
      return;
    }
    const minutes = minutesNow();
    setNowTop(Math.max(0, Math.min(bodyH, (minutes - DAY_START) * (HOUR_H / 60))));
    const t = setInterval(() => {
      const m = minutesNow();
      setNowTop(Math.max(0, Math.min(bodyH, (m - DAY_START) * (HOUR_H / 60))));
    }, 60000);
    return () => clearInterval(t);
  }, [dateISO, bodyH]);

  return (
    <div className="day-sched">
      {/* header row */}
      <div
        className="day-grid"
        style={{ gridTemplateColumns: `56px repeat(${members.length + 1}, minmax(128px, 1fr))` }}
      >
        <div />
        {members.map((m) => (
          <div key={m.id} className="day-head-cell">
            <div className="day-head-avatar">{m.user.name.slice(0, 1)}</div>
            {m.user.name}
          </div>
        ))}
        <div className="day-head-cell unassigned">未割当</div>
      </div>

      {/* body row */}
      <div
        className="day-grid"
        style={{ gridTemplateColumns: `56px repeat(${members.length + 1}, minmax(128px, 1fr))` }}
      >
        {/* hour labels */}
        <div className="col-body" style={{ height: bodyH }}>
          {hourLabels.map((min) => (
            <div
              key={min}
              className="hour-label"
              style={{ top: ((min - DAY_START) / 60) * HOUR_H }}
            >
              {`${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`}
            </div>
          ))}
        </div>

        {/* staff columns */}
        {members.map((m) => (
          <div key={m.id} className="col-body col-gridlines" style={{ height: bodyH }}>
            {slotMins.map((min) => (
              <button
                key={min}
                className="time-slot"
                style={{ top: ((min - DAY_START) / 60) * HOUR_H }}
                onClick={() => onCreateAt(dateISO, m.user.id, min)}
                aria-label={`${m.user.name} ${fmtMin(min)}`}
              />
            ))}
            {layoutBlocks(
              jobs.filter((j) => j.assignments.some((a) => a.member_id === m.user.id)),
            ).map((blk) => (
              <div
                key={blk.job.id}
                className="job-pos"
                style={{
                  top: ((blk.start - DAY_START) / 60) * HOUR_H,
                  height: Math.max(20, ((blk.end - blk.start) / 60) * HOUR_H - 2),
                  left: `${blk.lane * (100 / blk.laneCount)}%`,
                  width: `${100 / blk.laneCount}%`,
                  ["--svc-default" as string]: blk.job.service_color || "#64748b",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectJob(blk.job);
                }}
              >
                <div className={"job-inner" + (blk.job.status_done ? " done" : "")}>
                  <b>{blk.job.customer_name}</b>
                  <span className="tm">
                    {fmtMin(blk.job.start_minute) || "未定"}
                    {blk.job.service_name ? ` ・ ${blk.job.service_name}` : ""}
                  </span>
                </div>
              </div>
            ))}
            {nowTop !== null && <div className="day-now-line" style={{ top: nowTop }} />}
          </div>
        ))}

        {/* unassigned column */}
        <div className="col-body col-gridlines unassigned-col" style={{ height: bodyH }}>
          {slotMins.map((min) => (
            <button
              key={min}
              className="time-slot"
              style={{ top: ((min - DAY_START) / 60) * HOUR_H }}
              onClick={() => onCreateAt(dateISO, null, min)}
              aria-label={`未割当 ${fmtMin(min)}`}
            />
          ))}
          {unassignedBlocks.map((blk) => (
            <div
              key={blk.job.id}
              className="job-pos"
              style={{
                top: ((blk.start - DAY_START) / 60) * HOUR_H,
                height: Math.max(20, ((blk.end - blk.start) / 60) * HOUR_H - 2),
                left: `${blk.lane * (100 / blk.laneCount)}%`,
                width: `${100 / blk.laneCount}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectJob(blk.job);
              }}
            >
              <div className="job-inner unassigned">
                <b>{blk.job.customer_name}</b>
                <span className="tm">{fmtMin(blk.job.start_minute) || "未定"}</span>
              </div>
            </div>
          ))}
          {nowTop !== null && <div className="day-now-line" style={{ top: nowTop }} />}
        </div>
      </div>
    </div>
  );
}
