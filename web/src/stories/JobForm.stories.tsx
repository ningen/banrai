import type { Meta, StoryObj } from "@storybook/react-vite";
import NewJobModal from "../components/NewJobModal";
import type { Service } from "../types";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const services: Service[] = [
  { id: "s1", name: "エアコンクリーニング", description: "", duration_min: 90, color: "#29A3E8" },
  { id: "s2", name: "ハウスクリーニング", description: "", duration_min: 180, color: "#E8A33D" },
  { id: "s3", name: "レンジフード", description: "", duration_min: 60, color: "#8A6BE0" },
];

const meta = {
  title: "Jobs/NewJobModal",
  component: NewJobModal,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    services,
    defaultDate: "2026-08-27",
    onClose: () => {},
    onCreated: () => {},
  },
} satisfies Meta<typeof NewJobModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

function FormDemo() {
  return (
    <div style={{ maxWidth: 320, display: "grid", gap: 10, fontFamily: "var(--font-sans)" }}>
      <h2 style={{ margin: 0, fontSize: 15 }}>フォームパーツ</h2>
      <div className="space-y-1.5">
        <Label htmlFor="demo">顧客名</Label>
        <Input id="demo" placeholder="丸山ビル 502号室" />
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Button>追加する</Button>
        <Button variant="outline">キャンセル</Button>
        <Button variant="ghost">今日</Button>
        <Button variant="destructive">削除</Button>
        <Button size="sm" variant="secondary">
          小さい
        </Button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Badge variant="outline" className="bg-[var(--surface-2)] text-[var(--muted)]">
          下書き
        </Badge>
        <Badge
          variant="outline"
          className="bg-[var(--indigo-10)] text-[var(--indigo)] border-[var(--indigo-20)]"
        >
          割当日
        </Badge>
        <Badge variant="outline" className="bg-[var(--done-soft)] text-[var(--done)]">
          完了
        </Badge>
        <Badge variant="outline" className="bg-[var(--danger-soft)] text-[var(--danger)]">
          キャンセル
        </Badge>
      </div>
    </div>
  );
}

export const FormAndBadges: Story = {
  render: () => <FormDemo />,
  parameters: { layout: "padded" },
};
