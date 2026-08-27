import type { Meta, StoryObj } from "@storybook/react-vite";
import DaySchedule from "../components/DaySchedule";
import type { Job, Member } from "../types";
import { todayISO } from "../date";

const mockMembers: Member[] = [
  { id: "m1", user: { id: "u1", name: "山田 健", email: "yamada@ex.co" }, role: "リーダー" },
  { id: "m2", user: { id: "u2", name: "佐藤 あきら", email: "sato@ex.co" }, role: "member" },
  { id: "m3", user: { id: "u3", name: "田中 千尋", email: "tanaka@ex.co" }, role: "member" },
];

const d = todayISO();

const mockJobs: Job[] = [
  {
    id: "j1",
    service_id: "s1",
    service_name: "エアコンクリーニング",
    service_color: "#29A3E8",
    customer_name: "丸山ビル 502号室",
    address: "",
    customer_id: null,
    phone: "",
    scheduled_date: d,
    start_minute: 600,
    duration_min: 90,
    status: "assigned",
    notes: "",
    assignments: [{ id: "a1", member_id: "u1" }],
  },
  {
    id: "j1b",
    service_id: "s1",
    service_name: "エアコンクリーニング",
    service_color: "#29A3E8",
    customer_name: "青木荘 203",
    address: "",
    customer_id: null,
    phone: "",
    scheduled_date: d,
    start_minute: 630,
    duration_min: 60,
    status: "assigned",
    notes: "",
    assignments: [{ id: "a1b", member_id: "u1" }],
  },
  {
    id: "j2",
    service_id: "s2",
    service_name: "ハウスクリーニング",
    service_color: "#E8A33D",
    customer_name: "佐藤様 戸建",
    address: "",
    customer_id: null,
    phone: "",
    scheduled_date: d,
    start_minute: 600,
    duration_min: 300,
    status: "done",
    notes: "",
    assignments: [{ id: "a2", member_id: "u2" }],
  },
  {
    id: "j3",
    service_id: "s3",
    service_name: "レンジフード",
    service_color: "#8A6BE0",
    customer_name: "高橋マンション 1201",
    address: "",
    customer_id: null,
    phone: "",
    scheduled_date: d,
    start_minute: 780,
    duration_min: 60,
    status: "draft",
    notes: "",
    assignments: [],
  },
  {
    id: "j4",
    service_id: null,
    service_name: null,
    service_color: null,
    customer_name: "しまむら商店",
    address: "",
    customer_id: null,
    phone: "",
    scheduled_date: d,
    start_minute: null,
    duration_min: 60,
    status: "draft",
    notes: "時間要相談",
    assignments: [],
  },
];

const meta = {
  title: "Calendar/DaySchedule",
  component: DaySchedule,
  tags: ["autodocs"],
  args: {
    dateISO: d,
    jobs: mockJobs,
    members: mockMembers,
    onSelectJob: () => {},
    onCreateAt: () => {},
  },
} satisfies Meta<typeof DaySchedule>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyDay: Story = {
  args: { jobs: [], members: mockMembers },
};

export const NoStaff: Story = {
  args: { jobs: mockJobs, members: [] },
};
