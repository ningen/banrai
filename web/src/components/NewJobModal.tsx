import { useState } from "react";
import type { Service } from "../types";
import { api } from "../api";
import { todayISO } from "../date";

type Props = {
  services: Service[];
  defaultDate?: string;
  onClose: () => void;
  onCreated: () => void;
};

export default function NewJobModal({ services, defaultDate, onClose, onCreated }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [startMinute, setStartMinute] = useState(600);
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          serviceId: serviceId || null,
          address,
          scheduledDate: date,
          startMinute,
          durationMin,
          notes,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(String((err as Error).message));
      setBusy(false);
    }
  };

  return (
    <div className="modal-wrap">
      <div className="overlay" onClick={onClose} style={{ position: "fixed", inset: 0 }} />
      <form className="modal" onSubmit={create}>
        <h3 style={{ margin: "0 0 14px" }}>作業を追加</h3>

        <div style={{ marginBottom: 12 }}>
          <label>顧客名 *</label>
          <input
            autoFocus
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="ex: 丸山ビル 502号室"
            required
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>サービス</label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            style={{ width: "100%" }}
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
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label>開始時刻</label>
            <input
              type="time"
              value={`${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setStartMinute((Number.isNaN(h) ? 9 : h) * 60 + (Number.isNaN(m) ? 0 : m));
              }}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <label>所要 (分)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>住所</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label>メモ</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        {error && <p className="error">{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "保存中…" : "追加する"}
          </button>
        </div>
      </form>
    </div>
  );
}
