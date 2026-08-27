import { useState } from "react";
import { toast } from "sonner";
import type { Service } from "../types";
import { api } from "../api";
import { todayISO, fmtMin } from "../date";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

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

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
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
      toast.success(`「${customerName}」の作業を追加しました`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>作業を追加</DialogTitle>
          <DialogDescription>顧客・日時・サービスを入力して追加。</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="customer">顧客名 *</Label>
            <Input
              id="customer"
              autoFocus
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="ex: 丸山ビル 502号室"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>サービス</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger>
                <SelectValue placeholder="（未設定）" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>日付</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>開始時刻</Label>
              <Input
                type="time"
                value={fmtMin(startMinute)}
                onChange={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  setStartMinute((Number.isNaN(h) ? 9 : h) * 60 + (Number.isNaN(m) ? 0 : m));
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>所要 (分)</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>住所</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>メモ</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "追加する"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
