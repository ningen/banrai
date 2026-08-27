-- Business domain tables for banrai (org-scoped).

create table "services" (
  "id" text primary key not null,
  "org_id" text not null references "organization"("id") on delete cascade,
  "name" text not null,
  "description" text not null default '',
  "duration_min" integer not null default 60,
  "active" integer not null default 1,
  "created_at" integer not null,
  "updated_at" integer not null
);
create index "services_org_id_idx" on "services" ("org_id");

create table "jobs" (
  "id" text primary key not null,
  "org_id" text not null references "organization"("id") on delete cascade,
  "service_id" text references "services"("id") on delete set null,
  "customer_name" text not null,
  "address" text not null default '',
  "scheduled_date" text not null,
  "start_minute" integer,
  "duration_min" integer not null default 60,
  "status" text not null default 'draft',
  "notes" text not null default '',
  "created_by" text,
  "created_at" integer not null,
  "updated_at" integer not null
);
create index "jobs_org_id_date_idx" on "jobs" ("org_id", "scheduled_date");
create index "jobs_org_id_status_idx" on "jobs" ("org_id", "status");

create table "job_assignments" (
  "id" text primary key not null,
  "org_id" text not null references "organization"("id") on delete cascade,
  "job_id" text not null references "jobs"("id") on delete cascade,
  "member_id" text not null,
  "created_at" integer not null
);
create index "job_assignments_job_id_idx" on "job_assignments" ("job_id");
create index "job_assignments_member_id_idx" on "job_assignments" ("member_id", "org_id");
