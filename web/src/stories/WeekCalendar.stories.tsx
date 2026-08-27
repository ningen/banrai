import type { Meta, StoryObj } from "@storybook/react-vite";
import WeekCalendar from "../components/WeekCalendar";
import type { Job, Member } from "../types";
import { startOfWeek, todayISO } from "../date";

const mockMembers: Member[] = [
  { id: "m1", user: { id: "u1", name: "山田 健", email: "yamada@ex.co" }, role: "リーダー" },
  { id: "m2", user: { id: "u2", name: "佐藤 あきら", email: "sato@ex.co" }, role: "member" },
  { id: "m3", user: { id: "u3", name: "田中 千尋", email: "tanaka@ex.co" }, role: "member" },
];

const w0 = startOfWeek(todayISO());

const mockJobs: Job[] = [
  {
    id: "j1",
    service_id: "s1",
    service_name: "エアコンクリーニング",
    service_color: "#29A3E8",
    customer_name: "丸山ビル 502号室",
    address: "",
    scheduled_date: todayISO(),
    start_minute: 600,
    duration_min: 90,
    status: "assigned",
    notes: "",
    assignments: [{ id: "a1", member_id: "u1" }],
  },
  {
    id: "j2",
    service_id: "s2",
    service_name: "ハウスクリーニング",
    service_color: "#E8A33D",
    customer_name: "佐藤様 戸建",
    address: "",
    scheduled_date: todayISO(),
    start_minute: 600,
    duration_min: 300,
    status: "done",
    notes: "",
    assignments: [{ id: "a2", member_id: "u2" }],
  },
  {
    id: "j3",
    service_id: null,
    service_name: null,
    service_color: null,
    customer_name: "しまむら商店",
    address: "",
    scheduled_date: w0,
    start_minute: null,
    duration_min: 60,
    status: "draft",
    notes: "",
    assignments: [],
  },
];

const meta = {
  title: "Calendar/WeekCalendar",
  component: WeekCalendar,
  tags: ["autodocs"],
  args: {
    jobs: mockJobs,
    members: mockMembers,
    weekStartISO: w0,
    onSelectJob: () => {},
    onCreateAt: () => {},
  },
} satisfies Meta<typeof WeekCalendar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyWeek: Story = {
  args: { jobs: [], members: mockMembers },
};

export const NoStaff: Story = {
  args: { jobs: mockJobs, members: [] },
};
