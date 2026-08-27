import { useState } from "react";
import type { Service, ServiceOption } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { SERVICE_COLORS } from "../pages/ServicesPage";

type Props = {
  initial?: Service | null;
  onClose: () => void;
  onSave: (data: Omit<Service, "id">) => Promise<void>;
};

function OptionsEditor({
  options,
  onChange,
}: {
  options: ServiceOption[];
  onChange: (o: ServiceOption[]) => void;
}) {
  const update = (i: number, field: "name" | "price", value: string) => {
    onChange(
      options.map((o, j) =>
        j === i ? { ...o, [field]: field === "price" ? Number(value) || 0 : value } : o,
      ),
    );
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
            placeholder="加算額 (円)"
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

export default function ServiceModal({ initial, onClose, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [durationMin, setDurationMin] = useState(initial?.duration_min ?? 60);
  const [color, setColor] = useState(initial?.color ?? SERVICE_COLORS[0]!);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [options, setOptions] = useState<ServiceOption[]>(initial?.options ?? []);
  const [busy, setBusy] = useState(false);

  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        name,
        description,
        duration_min: hours * 60 + mins,
        color,
        price,
        options: options.filter((o) => o.name.trim() !== ""),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "サービスを編集" : "サービスを追加"}</DialogTitle>
          <DialogDescription>
            所要時間は「時間 + 分」、オプションは任意で追加できます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>名前 *</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ex: エアコンクリーニング"
            />
          </div>
          <div className="space-y-1.5">
            <Label>説明 (任意)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>時間</Label>
              <Select
                value={String(hours)}
                onValueChange={(v) => setDurationMin(Number(v) * 60 + mins)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h}時間
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>分</Label>
              <Select
                value={String(mins)}
                onValueChange={(v) => setDurationMin(hours * 60 + Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 15, 30, 45].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m}分
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>基本料金 (円)</Label>
              <Input
                type="number"
                min={0}
                step={500}
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
                    width: 28,
                    height: 28,
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
            <OptionsEditor options={options} onChange={setOptions} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
