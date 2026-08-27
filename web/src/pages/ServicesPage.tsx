import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { Service, ServiceOption } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export const SERVICE_COLORS = [
  "#29A3E8", // aircon
  "#E8A33D", // house
  "#8A6BE0", // hood
  "#2F6B45", // moss
  "#A6402A", // rust
  "#64748B", // slate
];

type OptionsEditorProps = {
  options: ServiceOption[];
  onChange: (options: ServiceOption[]) => void;
};

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const update = (i: number, field: "name" | "price", value: string) => {
    const next = [...options];
    next[i] = { ...next[i]!, [field]: field === "price" ? Number(value) || 0 : value };
    onChange(next);
  };
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Input
            value={o.name}
            placeholder="オプション名 (ex: グリル洗浄)"
            onChange={(e) => update(i, "name", e.target.value)}
            className="flex-1"
          />
          <Input
            type="number"
            min={0}
            step={100}
            value={o.price || ""}
            placeholder="加算額"
            onChange={(e) => update(i, "price", e.target.value)}
            className="w-32 num"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(options.filter((_, x) => x !== i))}
          >
            削除
          </Button>
        </div>
      ))}
      <div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onChange([...options, { name: "", price: 0 }])}
        >
          + オプション追加
        </Button>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SERVICE_COLORS[0]!);
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [options, setOptions] = useState<ServiceOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceOption[]>([]);
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
      const payload: Record<string, unknown> = {
        name,
        durationMin: Number(duration),
        color,
        price: Number(price),
        options: options.filter((o) => o.name.trim() !== ""),
      };
      await api("/api/services", { method: "POST", body: JSON.stringify(payload) });
      toast.success(`サービス「${name}」を追加しました`);
      setName("");
      setColor(SERVICE_COLORS[0]!);
      setOptions([]);
      setPrice(0);
      load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const patch = async (id: string, data: Record<string, unknown>, silent = true) => {
    await api(`/api/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }).catch(
      (err) => {
        if (!silent) setError(String((err as Error).message));
      },
    );
    load();
  };

  const remove = async (id: string) => {
    await api(`/api/services/${id}`, { method: "DELETE" });
    load();
  };

  const saveOptions = async (id: string) => {
    await patch(id, { options: draft.filter((o) => o.name.trim() !== "") });
    setEditingId(null);
    toast.success("オプションを保存しました");
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>サービス</h2>
          <div className="sub">
            提供作業のメニュー。カラ―はカレンダー、単価・オプションは作業作成時の参考になります。
          </div>
        </div>
      </div>

      <form className="card" onSubmit={create} style={{ display: "grid", gap: 12 }}>
        <div className="grid grid-cols-[1fr_140px_1fr] gap-3 items-end">
          <div className="space-y-1.5">
            <Label>名前 (ex: エアコンクリーニング)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>標準 (分)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>基本料金 (円)</Label>
            <Input
              type="number"
              min={0}
              step={100}
              value={price || ""}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="num"
            />
          </div>
        </div>
        <div>
          <Label>カラー</Label>
          <div style={{ display: "flex", gap: 6 }}>
            {SERVICE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: c,
                  border: c === color ? "2px solid var(--ink)" : "1px solid var(--line)",
                }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>オプション (任意)</Label>
          <div
            className="card"
            style={{ boxShadow: "none", padding: 10, background: "var(--surface-2)" }}
          >
            <OptionsEditor options={options} onChange={setOptions} />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <div>
          <Button type="submit">追加</Button>
        </div>
      </form>

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th>カラー</th>
              <th>名前</th>
              <th>所要</th>
              <th>基本料金</th>
              <th>オプション</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <ServiceRows
                key={s.id}
                service={s}
                editing={editingId === s.id}
                draft={draft}
                setDraft={setDraft}
                onEdit={() => {
                  setDraft(s.options ?? []);
                  setEditingId(s.id);
                }}
                onCancel={() => setEditingId(null)}
                onSave={() => void saveOptions(s.id)}
                onPatch={patch}
                onRemove={() => remove(s.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceRows({
  service: s,
  editing,
  draft,
  setDraft,
  onEdit,
  onCancel,
  onSave,
  onPatch,
  onRemove,
}: {
  service: Service;
  editing: boolean;
  draft: ServiceOption[];
  setDraft: (o: ServiceOption[]) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onPatch: (id: string, data: Record<string, unknown>, silent?: boolean) => Promise<void>;
  onRemove: () => void;
}) {
  return (
    <>
      <tr>
        <td>
          <div style={{ display: "flex", gap: 4 }}>
            {SERVICE_COLORS.map((c) => (
              <button
                key={c}
                className="sm"
                style={{
                  width: 20,
                  height: 20,
                  background: c,
                  border: c === s.color ? "2px solid var(--ink)" : "1px solid var(--line)",
                }}
                onClick={() => onPatch(s.id, { color: c })}
              />
            ))}
          </div>
        </td>
        <td>
          <Input
            defaultValue={s.name}
            className="py-0 px-1 border-transparent hover:border-input"
            onBlur={(e) =>
              e.target.value !== s.name && onPatch(s.id, { name: e.target.value }, true)
            }
          />
        </td>
        <td>
          <Input
            type="number"
            min={15}
            step={15}
            defaultValue={s.duration_min}
            className="w-20 num py-0 px-1 border-transparent hover:border-input"
            onBlur={(e) =>
              Number(e.target.value) !== s.duration_min &&
              onPatch(s.id, { durationMin: Number(e.target.value) }, true)
            }
          />
        </td>
        <td>
          <Input
            type="number"
            min={0}
            step={100}
            defaultValue={s.price || ""}
            className="w-28 num py-0 px-1 border-transparent hover:border-input"
            onBlur={(e) =>
              Number(e.target.value) !== s.price &&
              onPatch(s.id, { price: Number(e.target.value) }, true)
            }
          />
        </td>
        <td style={{ maxWidth: 240 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {(s.options ?? []).map((o, i) => (
              <span key={i} className="chip">
                <span className="svc-dot" style={{ background: s.color }} />
                {o.name}
                {o.price ? ` +¥${o.price.toLocaleString()}` : ""}
              </span>
            ))}
            {!editing && (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                編集
              </Button>
            )}
          </div>
        </td>
        <td>
          <Button size="sm" variant="outline" onClick={onRemove}>
            削除
          </Button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} style={{ background: "var(--surface-2)" }}>
            <div style={{ display: "grid", gap: 8, padding: "6px 2px" }}>
              <OptionsEditor options={draft} onChange={setDraft} />
              <div style={{ display: "flex", gap: 6 }}>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={onSave}>
                  保存
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
