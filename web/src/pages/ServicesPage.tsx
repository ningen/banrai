import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { api } from "../api";
import type { Service } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import ServiceModal from "../components/ServiceModal";

export const SERVICE_COLORS = [
  "#29A3E8", // aircon
  "#E8A33D", // house
  "#8A6BE0", // hood
  "#2F6B45", // moss
  "#A6402A", // rust
  "#64748B", // slate
];

function fmtDuration(min: number): string {
  if (min % 60 === 0) return `${min / 60}時間`;
  return `${Math.floor(min / 60)}時間${min % 60}分`;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ services: Service[] }>("/api/services")
      .then((r) => setServices(r.services))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (data: Omit<Service, "id">, id?: string) => {
    const payload = {
      name: data.name,
      description: data.description,
      durationMin: data.duration_min,
      color: data.color,
      price: data.price,
      options: data.options,
    };
    if (id) {
      await api(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success(`「${data.name}」を更新しました`);
    } else {
      await api("/api/services", { method: "POST", body: JSON.stringify(payload) });
      toast.success(`「${data.name}」を追加しました`);
    }
    setCreating(false);
    setEditing(null);
    load();
  };

  const remove = async (s: Service) => {
    if (!confirm(`「${s.name}」を削除しますか?`)) return;
    await api(`/api/services/${s.id}`, { method: "DELETE" });
    load();
  };

  const visible = services.filter((s) => (q ? s.name.includes(q) : true));

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>サービス</h2>
          <div className="sub">作業メニュー。所要・基本料金・オプションを登録できます。</div>
        </div>
        <Button onClick={() => setCreating(true)}>+ サービスを追加</Button>
      </div>

      <div style={{ position: "relative", marginBottom: 14, maxWidth: 360 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
        <Input
          className="pl-9"
          placeholder="サービス名で検索…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>名前</th>
              <th>所要</th>
              <th>基本料金</th>
              <th>オプション</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id}>
                <td>
                  <span
                    className="svc-dot"
                    style={{ background: s.color, width: 12, height: 12, borderRadius: "50%" }}
                  />
                </td>
                <td>
                  <b>{s.name}</b>
                  {s.description && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.description}
                    </div>
                  )}
                </td>
                <td>{fmtDuration(s.duration_min)}</td>
                <td className="num">{s.price ? `¥${s.price.toLocaleString()}` : "—"}</td>
                <td style={{ maxWidth: 260 }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {(s.options ?? []).map((o, i) => (
                      <span key={i} className="chip">
                        <span className="svc-dot" style={{ background: s.color }} />
                        {o.name}
                        {o.price ? ` +¥${o.price.toLocaleString()}` : ""}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                      編集
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(s)}>
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 18 }}>
                  {q ? "検索結果がありません" : "サービスがありません。右上から追加してください。"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <ServiceModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(data) => save(data, editing?.id)}
        />
      )}
    </div>
  );
}
