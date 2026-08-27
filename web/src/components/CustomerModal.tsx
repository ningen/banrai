import { useState } from "react";
import type { Customer, CustomerAddress } from "../types";
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

const EMPTY_ADDRESS: CustomerAddress = { postal: "", prefecture: "", city: "", rest: "" };

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

function AddressEditor({
  addresses,
  onChange,
}: {
  addresses: CustomerAddress[];
  onChange: (v: CustomerAddress[]) => void;
}) {
  const update = (i: number, field: keyof CustomerAddress, value: string) => {
    onChange(addresses.map((a, j) => (j === i ? { ...a, [field]: value } : a)));
  };
  return (
    <div>
      <Label>住所</Label>
      <div style={{ display: "grid", gap: 8 }}>
        {addresses.map((a, i) => (
          <div
            key={i}
            className="card"
            style={{
              boxShadow: "none",
              padding: 10,
              background: "var(--surface-2)",
              display: "grid",
              gap: 6,
            }}
          >
            <div className="grid grid-cols-[110px_1fr] gap-2">
              <Input
                className="num"
                placeholder="〒 郵便番号"
                value={a.postal}
                onChange={(e) => update(i, "postal", e.target.value)}
              />
              <Input
                placeholder="都道府県 (ex: 東京都)"
                value={a.prefecture}
                onChange={(e) => update(i, "prefecture", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="市区町村 (ex: 渋谷区)"
                value={a.city}
                onChange={(e) => update(i, "city", e.target.value)}
              />
              <Input
                placeholder="以降 (町名・番地・建物)"
                value={a.rest}
                onChange={(e) => update(i, "rest", e.target.value)}
              />
            </div>
            <div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(addresses.filter((_, j) => j !== i))}
              >
                この住所を削除
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onChange([...addresses, { ...EMPTY_ADDRESS }])}
          >
            + 住所を追加
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
  const [addresses, setAddresses] = useState<CustomerAddress[]>(
    initial?.addresses ?? [{ ...EMPTY_ADDRESS }],
  );
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
        addresses: addresses.filter((a) => a.prefecture || a.city || a.rest || a.postal),
        notes,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "顧客を編集" : "顧客を追加"}</DialogTitle>
          <DialogDescription>
            電話・メール・住所は複数登録できます。住所は郵便番号・都道府県・市区町村・以降に分かれます。
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
          <AddressEditor addresses={addresses} onChange={setAddresses} />
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
