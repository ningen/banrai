import type { Meta, StoryObj } from "@storybook/react-vite";
import JobDrawer from "../components/JobDrawer";
import type { Job, Member, Service } from "../types";

const members: Member[] = [
  { id: "m1", user: { id: "u1", name: "山田 健", email: "yamada@ex.co" }, role: "リーダー" },
  { id: "m2", user: { id: "u2", name: "佐藤 あきら", email: "sato@ex.co" }, role: "member" },
  { id: "m3", user: { id: "u3", name: "田中 千尋", email: "tanaka@ex.co" }, role: "member" },
];

const services: Service[] = [
  { id: "s1", name: "エアコンクリーニング", description: "", duration_min: 90, color: "#29A3E8" },
  { id: "s2", name: "ハウスクリーニング", description: "", duration_min: 180, color: "#E8A33D" },
  { id: "s3", name: "レンジフード", description: "", duration_min: 60, color: "#8A6BE0" },
];

const job: Job = {
  id: "j1",
  service_id: "s1",
  service_name: "エアコンクリーニング",
  service_color: "#29A3E8",
  customer_name: "丸山ビル 502号室",
  address: "東京都千代田区丸の内1-2-3",
  scheduled_date: "2026-08-27",
  start_minute: 600,
  duration_min: 90,
  status: "assigned",
  notes: "室外機は駐車場側、鍵は管理人に預けた",
  assignments: [{ id: "a1", member_id: "u1" }],
};

const meta = {
  title: "Jobs/JobDrawer",
  component: JobDrawer,
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
  args: {
    job,
    services,
    members,
    onClose: () => {},
    onChanged: () => {},
  },
} satisfies Meta<typeof JobDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssignedJob: Story = {};

export const UnassignedDraft: Story = {
  args: {
    job: {
      ...job,
      status: "draft",
      assignments: [],
      start_minute: null,
      customer_name: "しまむら商店",
    },
  },
};
