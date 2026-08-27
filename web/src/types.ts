export type ServiceOption = { name: string; price: number };

export type Service = {
  id: string;
  name: string;
  description: string;
  duration_min: number;
  color: string;
  price: number;
  options: ServiceOption[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

export type Member = {
  id: string;
  user: { id: string; name: string; email: string };
  role: string;
};

export type Assignment = { id: string; member_id: string };

export type Job = {
  id: string;
  service_id: string | null;
  service_name: string | null;
  service_color: string | null;
  customer_id: string | null;
  customer_name: string;
  phone: string;
  address: string;
  scheduled_date: string;
  start_minute: number | null;
  duration_min: number;
  status: "draft" | "assigned" | "done" | "cancelled";
  notes: string;
  assignments: Assignment[];
};

export type DayCell = {
  job: Job;
  memberId?: string;
  dayIndex: number;
};
