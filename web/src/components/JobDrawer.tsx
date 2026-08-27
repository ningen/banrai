import { useState } from "react";
import type { Job, Member, Service } from "../types";
import { fmtMin } from "../date";
import { StatusChip } from "./bits";
import { api } from "../api";

type Props = {
  job: Job;
  services: Service[];
  members: Member[];
  onClose: () => void;
  onChanged: () => void;
};

const STATUS_ORDER: Job["status"][] = ["draft", "assigned", "done", "cancelled"];
const STATUS_JP: Record<Job["status"], string> = {
  draft: "下書き",
  assigned: "割当日",
  done: "完了",
  cancelled: "キャンセル",
};

export default function JobDrawer({ job, services, members, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (data: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify(data) });
      onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (memberId: string) => {
    if (!memberId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jobs/${job.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (memberId: string) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/jobs/${job.id}/assign/${memberId}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <StatusChip status={job.status} />
          <button className="ghost sm" onClick={onClose}>
            閉じる ✕
          </button>
        </div>
        <h3 style={{ margin: "0 0 2px", fontSize: 17 }}>{job.customer_name}</h3>
        <div className="muted" style={{ marginBottom: 14 }}>
          {job.service_name ?? "サービス未設定"} ・ {fmtMin(job.start_minute) || "時間未定"}〜 ・{" "}
          {job.duration_min}分
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>サービス</label>
          <select
            value={job.service_id ?? ""}
            style={{ width: "100%" }}
            onChange={(e) => patch({ serviceId: e.target.value || null })}
          >
            <option value="">（未設定）</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row" style={{ marginBottom: 12 }}>
          <div>
            <label>日付</label>
            <input
              type="date"
              value={job.scheduled_date}
              style={{ width: "100%" }}
              onChange={(e) => patch({ scheduledDate: e.target.value })}
            />
          </div>
          <div>
            <label>開始時刻</label>
            <input
              type="time"
              defaultValue={fmtMin(job.start_minute)}
              style={{ width: "100%" }}
              onBlur={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (!Number.isNaN(h)) void patch({ startMinute: h * 60 + (m || 0) });
              }}
            />
          </div>
          <div>
            <label>所要 (分)</label>
            <input
              type="number"
              value={job.duration_min}
              min={15}
              step={15}
              style={{ width: "100%" }}
              onChange={(e) => void patch({ durationMin: Number(e.target.value) })}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>住所</label>
          <input
            value={job.address}
            placeholder="住所"
            style={{ width: "100%" }}
            onChange={(e) => void patch({ address: e.target.value })}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label>メモ</label>
          <textarea
            value={job.notes}
            rows={3}
            style={{ width: "100%" }}
            onChange={(e) => void patch({ notes: e.target.value })}
          />
        </div>

        <label>担当スタッフ</label>
        {job.assignments.map((a) => (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 4px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span style={{ flex: 1 }}>
              {members.find((m) => m.user.id === a.member_id)?.user.name ?? "?"}
            </span>
            <button className="sm" disabled={busy} onClick={() => unassign(a.member_id)}>
              外す
            </button>
          </div>
        ))}
        <select
          value=""
          style={{ width: "100%", marginTop: 8 }}
          onChange={(e) => assign(e.target.value)}
          disabled={busy}
        >
          <option value="">スタッフを割り当てる…</option>
          {members
            .filter((m) => !job.assignments.some((a) => a.member_id === m.user.id))
            .map((m) => (
              <option key={m.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
        </select>

        <div style={{ marginTop: 18 }}>
          <label>状態</label>
          <div className="status-btns">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                disabled={busy}
                className={`sm active-${s === "assigned" ? "assigned" : s} ${job.status === s ? `active-${s}` : ""}`}
                onClick={() => patch({ status: s })}
              >
                {STATUS_JP[s]}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}
      </div>
    </>
  );
}
