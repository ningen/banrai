import { useState } from "react";
import type { Customer } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

type Props = {
  initial?: Customer | null;
  onClose: () => void;
  onSave: (data: Omit<Customer, "id">) => Promise<void>;
};

function StringListEditor({
  title,
  values,
  placeholder,
  onChange,
}: {
  title: string;
  values: string[];
  placeholder: string;
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <Label>{title}</Label>
      <div style={{ display: "grid", gap: 6 }}>
        {values.map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <Input
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
            >
              削除
            </Button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="outline" onClick={() => onChange([...values, ""])}>
            + 追加
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerModal({ initial, onClose, onSave }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phones, setPhones] = useState<string[]>(initial?.phones ?? [""]);
  const [emails, setEmails] = useState<string[]>(initial?.emails ?? [""]);
  const [addresses, setAddresses] = useState<string[]>(initial?.addresses ?? [""]);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave({
        name,
        phones: phones.filter((x) => x.trim() !== ""),
        emails: emails.filter((x) => x.trim() !== ""),
        addresses: addresses.filter((x) => x.trim() !== ""),
        notes,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "顧客を編集" : "顧客を追加"}</DialogTitle>
          <DialogDescription>
            連絡先は複数登録できます。空欄の行は保存時に除外されます。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>名前 *</Label>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <StringListEditor
            title="電話番号"
            values={phones}
            placeholder="090-1234-5678"
            onChange={setPhones}
          />
          <StringListEditor
            title="メールアドレス"
            values={emails}
            placeholder="name@example.com"
            onChange={setEmails}
          />
          <StringListEditor
            title="住所"
            values={addresses}
            placeholder="東京都…"
            onChange={setAddresses}
          />
          <div className="space-y-1.5">
            <Label>メモ</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
