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

export type CustomerAddress = {
  postal: string;
  prefecture: string;
  city: string;
  rest: string;
};

export type Customer = {
  id: string;
  name: string;
  phones: string[];
  emails: string[];
  addresses: CustomerAddress[];
  notes: string;
};

export function joinAddress(a: CustomerAddress): string {
  return `${a.prefecture}${a.city}${a.rest}`.trim() || (a.postal ? `〒${a.postal}` : "");
}

export type JobStatus = {
  name: string;
  color: string;
  done: boolean;
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
  address_postal: string;
  address_prefecture: string;
  address_city: string;
  address_rest: string;
  scheduled_date: string;
  start_minute: number | null;
  duration_min: number;
  status: string;
  status_color: string | null;
  status_done: number | null;
  notes: string;
  assignments: Assignment[];
};

export type DayCell = {
  job: Job;
  memberId?: string;
  dayIndex: number;
};
