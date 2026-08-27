import { useState } from "react";
import { toast } from "sonner";
import type { Job, Member, Service } from "../types";
import { fmtMin } from "../date";
import { StatusChip } from "./bits";
import { api } from "../api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

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

  const patch = async (data: Record<string, unknown>, message?: string) => {
    setBusy(true);
    try {
      await api(`/api/jobs/${job.id}`, { method: "PATCH", body: JSON.stringify(data) });
      if (message) toast.success(message);
      onChanged();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const assign = async (memberId: string) => {
    if (!memberId) return;
    setBusy(true);
    try {
      await api(`/api/jobs/${job.id}/assign`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      });
      toast.success("スタッフを割り当てました");
      onChanged();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const unassign = async (memberId: string) => {
    setBusy(true);
    try {
      await api(`/api/jobs/${job.id}/assign/${memberId}`, { method: "DELETE" });
      toast.success("割当を外しました");
      onChanged();
    } catch (err) {
      toast.error(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[440px]">
        <SheetHeader className="pr-8">
          <SheetTitle className="flex items-center gap-2">
            {job.customer_name} <StatusChip status={job.status} />
          </SheetTitle>
          <SheetDescription>
            {job.service_name ?? "サービス未設定"} ・ {fmtMin(job.start_minute) || "時間未定"}〜 ・{" "}
            {job.duration_min}分
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <Label>サービス</Label>
            <Select
              value={job.service_id ?? "__none__"}
              onValueChange={(v) => patch({ serviceId: v === "__none__" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="（未設定）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">（未設定）</SelectItem>
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
              <Input
                type="date"
                value={job.scheduled_date}
                onChange={(e) => patch({ scheduledDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>開始時刻</Label>
              <Input
                type="time"
                defaultValue={fmtMin(job.start_minute)}
                onBlur={(e) => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  if (!Number.isNaN(h)) void patch({ startMinute: h * 60 + (m || 0) });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>所要 (分)</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={job.duration_min}
                onChange={(e) => patch({ durationMin: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>電話 / 住所</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                className="num"
                value={job.phone}
                placeholder="電話"
                onChange={(e) => patch({ phone: e.target.value })}
              />
              <Input
                value={job.address}
                placeholder="住所"
                onChange={(e) => patch({ address: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>メモ</Label>
            <Textarea
              rows={3}
              value={job.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>担当スタッフ</Label>
            {job.assignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 py-1.5 border-b border-[var(--line)]"
              >
                <span className="flex-1 text-sm">
                  {members.find((m) => m.user.id === a.member_id)?.user.name ?? "?"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => unassign(a.member_id)}
                >
                  外す
                </Button>
              </div>
            ))}
            <Select onValueChange={(v) => assign(v)} disabled={busy}>
              <SelectTrigger>
                <SelectValue placeholder="スタッフを割り当てる…" />
              </SelectTrigger>
              <SelectContent>
                {members
                  .filter((m) => !job.assignments.some((a) => a.member_id === m.user.id))
                  .map((m) => (
                    <SelectItem key={m.id} value={m.user.id}>
                      {m.user.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 pt-2">
            <Label>状態</Label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_ORDER.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={job.status === s ? "default" : "outline"}
                  disabled={busy}
                  onClick={() => patch({ status: s }, `状態を「${STATUS_JP[s]}」に変更しました`)}
                >
                  {STATUS_JP[s]}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
