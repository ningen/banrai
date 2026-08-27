import { useState } from "react";
import { toast } from "sonner";
import type { Customer, Member, Service } from "../types";
import { api } from "../api";
import { todayISO } from "../date";
import { DurationSelect, TimeSelect } from "./TimeSelect";
import DatePicker from "./DatePicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

type Props = {
  services: Service[];
  members: Member[];
  customers: Customer[];
  defaultDate?: string;
  defaultStaffId?: string | null;
  defaultStartMinute?: number | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function NewJobModal({
  services,
  members,
  customers,
  defaultDate,
  defaultStaffId,
  defaultStartMinute,
  onClose,
  onCreated,
}: Props) {
  const [customerName, setCustomerName] = useState(defaultStaffId ? "" : "");
  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [phone, setPhone] = useState("");
  const [staffId, setStaffId] = useState(defaultStaffId ?? "");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState(defaultDate ?? todayISO());
  const [startMinute, setStartMinute] = useState(defaultStartMinute ?? 600);
  const [durationMin, setDurationMin] = useState(60);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      if (c.phones.length > 0) setPhone(c.phones[0]!);
      if (c.addresses.length > 0) setAddress(c.addresses[0]!);
    } else {
      setCustomerId("");
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ id: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || null,
          customerName,
          phone,
          address,
          serviceId: serviceId || null,
          scheduledDate: date,
          startMinute,
          durationMin,
          notes,
        }),
      });
      if (staffId) {
        await api(`/api/jobs/${res.id}/assign`, {
          method: "POST",
          body: JSON.stringify({ memberId: staffId }),
        });
      }
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
          <DialogDescription>顧客・日時・サービス・担当を入力して追加。</DialogDescription>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>顧客 (既存)</Label>
              <Select value={customerId} onValueChange={pickCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder="新規名で入力する" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>顧客名 (選択 or 入力)</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1.5">
              <Label>担当 (任意)</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger>
                  <SelectValue placeholder="あとで選ぶ" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.user.id}>
                      {m.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>日付</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="space-y-1.5">
              <Label>開始時刻</Label>
              <TimeSelect value={startMinute} onValueChange={setStartMinute} />
            </div>
            <div className="space-y-1.5">
              <Label>所要時間</Label>
              <DurationSelect value={durationMin} onValueChange={setDurationMin} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>電話 / 住所</Label>
            <div className="grid grid-cols-2 gap-3">
              {customerId && customers.find((c) => c.id === customerId)?.phones.length ? (
                <Select value={phone} onValueChange={setPhone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers
                      .find((c) => c.id === customerId)!
                      .phones.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={phone}
                  placeholder="電話"
                  onChange={(e) => setPhone(e.target.value)}
                />
              )}
              {customerId && customers.find((c) => c.id === customerId)?.addresses.length ? (
                <Select value={address} onValueChange={setAddress}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customers
                      .find((c) => c.id === customerId)!
                      .addresses.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={address}
                  placeholder="住所"
                  onChange={(e) => setAddress(e.target.value)}
                />
              )}
            </div>
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
