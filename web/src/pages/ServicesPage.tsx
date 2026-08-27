import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { Service } from "../types";

export const SERVICE_COLORS = [
  "#29A3E8", // aircon
  "#E8A33D", // house
  "#8A6BE0", // hood
  "#2F6B45", // moss
  "#A6402A", // rust
  "#64748B", // slate
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SERVICE_COLORS[0]!);
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ services: Service[] }>("/api/services")
      .then((r) => setServices(r.services))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({ name, durationMin: Number(duration), color }),
      });
      setName("");
      load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    await api(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/services/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>サービス</h2>
          <div className="sub">提供する作業のメニュー。カレンダー上の色を決められます。</div>
        </div>
      </div>

      <form className="card grid-form" onSubmit={create}>
        <div style={{ minWidth: 220 }}>
          <label>名前 (ex: エアコンクリーニング)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>標準時間 (分)</label>
          <input
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <div>
          <label>カラー</label>
          <div style={{ display: "flex", gap: 6 }}>
            {SERVICE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                style={{
                  padding: 0,
                  width: 26,
                  height: 26,
                  background: c,
                  border: c === color ? "2px solid var(--ink)" : "1px solid var(--line)",
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <button className="primary">追加</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th>カラー</th>
              <th>名前</th>
              <th>標準時間</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    {SERVICE_COLORS.map((c) => (
                      <button
                        key={c}
                        className="sm"
                        style={{
                          padding: 0,
                          width: 20,
                          height: 20,
                          background: c,
                          border: c === s.color ? "2px solid var(--ink)" : "1px solid var(--line)",
                        }}
                        onClick={() => patch(s.id, { color: c })}
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <input
                    value={s.name}
                    style={{ border: "none", padding: "2px 0" }}
                    onBlur={(e) =>
                      e.target.value !== s.name && patch(s.id, { name: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={s.duration_min}
                    style={{ width: 70 }}
                    onBlur={(e) =>
                      Number(e.target.value) !== s.duration_min &&
                      patch(s.id, { durationMin: Number(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <button className="sm danger" onClick={() => remove(s.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
