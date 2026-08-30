import {
  McpServer,
  type CallToolResult,
  type McpRequestContext,
} from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { can } from "./perm";
import { ensureDefaultStatuses, listStatuses } from "../statuses";
import {
  assignSchema,
  customerSchema,
  jobSchema,
  joinAddressParts,
  normalizeAddress,
  serviceSchema,
  statusSchema,
} from "../routes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const idSchema = z.object({ id: z.string().min(1) });
const updateServiceSchema = z.object({ id: z.string().min(1), ...serviceSchema.partial().shape });
const listCustomersSchema = z.object({ q: z.string().max(200).optional() });
const listJobsSchema = z.object({
  from: z.string().regex(DATE_RE).optional(),
  to: z.string().regex(DATE_RE).optional(),
  memberId: z.string().optional(),
  q: z.string().max(200).optional(),
});
const updateCustomerSchema = z.object({ id: z.string().min(1), ...customerSchema.partial().shape });
const updateJobSchema = z.object({ id: z.string().min(1), ...jobSchema.partial().shape });
const assignJobSchema = z.object({ id: z.string().min(1), ...assignSchema.shape });
const deleteStatusSchema = z.object({ name: z.string().min(1).max(30) });

const ok = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const deny = (resource: string, action: string): CallToolResult => ({
  content: [
    {
      type: "text",
      text: `permission denied: ${resource}:${action}. あなたのロールではこの操作は許可されていません。`,
    },
  ],
  isError: true,
});
const fail = (message: string): CallToolResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

const readJobs = async (
  env: Env,
  orgId: string,
  q: string,
  from: string,
  to: string,
  memberId: string | undefined,
) => {
  await ensureDefaultStatuses(env, orgId);
  let sql =
    "SELECT j.*, s.name AS service_name, s.color AS service_color, js.color AS status_color, js.done AS status_done FROM jobs j LEFT JOIN services s ON s.id = j.service_id LEFT JOIN job_statuses js ON js.org_id = j.org_id AND js.name = j.status WHERE j.org_id = ?";
  const binds: string[] = [orgId];
  if (q) {
    sql += " AND (j.customer_name LIKE ? OR j.address LIKE ? OR j.phone LIKE ? OR j.notes LIKE ?)";
    const like = `%${q}%`;
    binds.push(like, like, like, like);
    sql += " ORDER BY j.scheduled_date DESC, j.start_minute LIMIT 200";
  } else {
    if (from) {
      sql += " AND j.scheduled_date >= ?";
      binds.push(from);
    }
    if (to) {
      sql += " AND j.scheduled_date <= ?";
      binds.push(to);
    }
    sql += " ORDER BY j.scheduled_date, j.start_minute";
  }
  const rows = (await env.DB.prepare(sql)
    .bind(...binds)
    .all()) as { results: any[] };
  const jobIds = rows.results.map((j: any) => j.id);
  const allAssignments = jobIds.length
    ? (
        await env.DB.prepare(
          "SELECT * FROM job_assignments WHERE org_id = ? AND job_id IN (" +
            jobIds.map(() => "?").join(",") +
            ")",
        )
          .bind(orgId, ...jobIds)
          .all()
      ).results
    : [];
  let jobs = rows.results;
  if (memberId) {
    const memberJobIds = new Set(
      allAssignments.filter((a: any) => a.member_id === memberId).map((a: any) => a.job_id),
    );
    jobs = jobs.filter((j: any) => memberJobIds.has(j.id));
  }
  const assignmentsByJob = new Map<string, any[]>();
  for (const a of allAssignments as any[]) {
    const list = assignmentsByJob.get(a.job_id) ?? [];
    list.push(a);
    assignmentsByJob.set(a.job_id, list);
  }
  return jobs.map((j: any) => ({ ...j, assignments: assignmentsByJob.get(j.id) ?? [] }));
};

export function buildMcpServer(env: Env, ctx: McpRequestContext): McpServer {
  const extra = (ctx.authInfo?.extra ?? {}) as { userId?: string; orgId?: string };
  const server = new McpServer({ name: "banrai", version: "1.0.0" });

  const identity = ():
    | { ok: true; userId: string; orgId: string }
    | { ok: false; message: string } => {
    if (!extra.userId || !extra.orgId)
      return { ok: false, message: "認証情報がありません。再接続してください。" };
    return { ok: true, userId: extra.userId, orgId: extra.orgId };
  };

  server.registerTool(
    "list_services",
    { description: "作業メニュー（サービス）の一覧を返す。", inputSchema: z.object({}) },
    async () => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "service", "read")))
        return deny("service", "read");
      const rows = (await env.DB.prepare(
        "SELECT * FROM services WHERE org_id = ? AND active = 1 ORDER BY created_at",
      )
        .bind(who.orgId)
        .all()) as { results: any[] };
      return ok(
        rows.results.map((r: any) => ({
          ...r,
          options: JSON.parse(r.options ?? "[]"),
          price: r.price ?? 0,
        })),
      );
    },
  );

  server.registerTool(
    "create_service",
    { description: "新しい作業メニュー（サービス）を作成する。", inputSchema: serviceSchema },
    async (body: z.infer<typeof serviceSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "service", "create")))
        return deny("service", "create");
      const now = Date.now();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO services (id, org_id, name, description, duration_min, color, price, options, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)",
      )
        .bind(
          id,
          who.orgId,
          body.name,
          body.description,
          body.durationMin,
          body.color,
          body.price,
          JSON.stringify(body.options),
          now,
          now,
        )
        .run();
      return ok({ id });
    },
  );

  server.registerTool(
    "update_service",
    {
      description: "作業メニュー（サービス）を更新する。指定したフィールドのみ更新される。",
      inputSchema: updateServiceSchema,
    },
    async (body: z.infer<typeof updateServiceSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "service", "update")))
        return deny("service", "update");
      const { id, ...rest } = body;
      const fields: Record<string, unknown> = {};
      if (rest.name !== undefined) fields.name = rest.name;
      if (rest.description !== undefined) fields.description = rest.description;
      if (rest.durationMin !== undefined) fields.duration_min = rest.durationMin;
      if (rest.color !== undefined) fields.color = rest.color;
      if (rest.price !== undefined) fields.price = rest.price;
      if (rest.options !== undefined) fields.options = JSON.stringify(rest.options);
      const keys = Object.keys(fields);
      if (keys.length) {
        const setSql = keys.map((k) => `${k} = ?`).join(", ");
        await env.DB.prepare(
          `UPDATE services SET ${setSql}, updated_at = ? WHERE id = ? AND org_id = ?`,
        )
          .bind(...keys.map((k) => fields[k] as string | number), Date.now(), id, who.orgId)
          .run();
      }
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "delete_service",
    { description: "作業メニュー（サービス）を削除（無効化）する。", inputSchema: idSchema },
    async ({ id }) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "service", "delete")))
        return deny("service", "delete");
      await env.DB.prepare("UPDATE services SET active = 0 WHERE id = ? AND org_id = ?")
        .bind(id, who.orgId)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_customers",
    {
      description: "顧客の一覧を返す。q で名前・電話・メール・住所・メモの部分一致検索ができる。",
      inputSchema: listCustomersSchema,
    },
    async ({ q }: z.infer<typeof listCustomersSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "customer", "read")))
        return deny("customer", "read");
      let sql = "SELECT * FROM customers WHERE org_id = ?";
      const binds: string[] = [who.orgId];
      if (q) {
        sql +=
          " AND (name LIKE ? OR phones LIKE ? OR emails LIKE ? OR addresses LIKE ? OR notes LIKE ?)";
        const like = `%${q}%`;
        binds.push(like, like, like, like, like);
      }
      sql += " ORDER BY name";
      const rows = (await env.DB.prepare(sql)
        .bind(...binds)
        .all()) as { results: any[] };
      return ok(
        rows.results.map((r: any) => ({
          ...r,
          phones: JSON.parse(r.phones || "[]"),
          emails: JSON.parse(r.emails || "[]"),
          addresses: (JSON.parse(r.addresses || "[]") as unknown[]).map(normalizeAddress),
        })),
      );
    },
  );

  server.registerTool(
    "create_customer",
    {
      description: "新しい顧客を作成する。phones / emails / addresses は配列で指定する。",
      inputSchema: customerSchema,
    },
    async (body: z.infer<typeof customerSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "customer", "create")))
        return deny("customer", "create");
      const now = Date.now();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO customers (id, org_id, name, phones, emails, addresses, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          who.orgId,
          body.name,
          JSON.stringify(body.phones),
          JSON.stringify(body.emails),
          JSON.stringify(body.addresses),
          body.notes,
          now,
          now,
        )
        .run();
      return ok({ id });
    },
  );

  server.registerTool(
    "update_customer",
    {
      description: "顧客を更新する。指定したフィールドのみ更新される。",
      inputSchema: updateCustomerSchema,
    },
    async (body: z.infer<typeof updateCustomerSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "customer", "update")))
        return deny("customer", "update");
      const { id, ...rest } = body;
      const fields: Record<string, unknown> = {};
      if (rest.name !== undefined) fields.name = rest.name;
      if (rest.notes !== undefined) fields.notes = rest.notes;
      if (rest.phones !== undefined) fields.phones = JSON.stringify(rest.phones);
      if (rest.emails !== undefined) fields.emails = JSON.stringify(rest.emails);
      if (rest.addresses !== undefined) fields.addresses = JSON.stringify(rest.addresses);
      const keys = Object.keys(fields);
      if (keys.length) {
        const setSql = keys.map((k) => `${k} = ?`).join(", ");
        await env.DB.prepare(
          `UPDATE customers SET ${setSql}, updated_at = ? WHERE id = ? AND org_id = ?`,
        )
          .bind(...keys.map((k) => fields[k] as string | number), Date.now(), id, who.orgId)
          .run();
      }
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "delete_customer",
    {
      description: "顧客を削除する。関連する作業の customer_id は null になる。",
      inputSchema: idSchema,
    },
    async ({ id }) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "customer", "delete")))
        return deny("customer", "delete");
      await env.DB.prepare(
        "UPDATE jobs SET customer_id = NULL WHERE customer_id = ? AND org_id = ?",
      )
        .bind(id, who.orgId)
        .run();
      await env.DB.prepare("DELETE FROM customers WHERE id = ? AND org_id = ?")
        .bind(id, who.orgId)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_jobs",
    {
      description:
        "作業の一覧を返す。from / to は YYYY-MM-DD (JST) の日付範囲、memberId でスタッフ割当で絞り込み、q で顧客名・住所・電話・メモの部分一致検索ができる。",
      inputSchema: listJobsSchema,
    },
    async ({ from, to, memberId, q }: z.infer<typeof listJobsSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "job", "read"))) return deny("job", "read");
      return ok({ jobs: await readJobs(env, who.orgId, q ?? "", from ?? "", to ?? "", memberId) });
    },
  );

  server.registerTool(
    "create_job",
    {
      description:
        "新しい作業を作成する。scheduledDate は YYYY-MM-DD (JST)、startMinute は JST 0時起点の分（例: 9:00 → 540）。status 指定がなければ「下書き」。",
      inputSchema: jobSchema,
    },
    async (body: z.infer<typeof jobSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "job", "create"))) return deny("job", "create");
      const now = Date.now();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO jobs (id, org_id, service_id, customer_id, customer_name, phone, address, address_postal, address_prefecture, address_city, address_rest, scheduled_date, start_minute, duration_min, status, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          who.orgId,
          body.serviceId ?? null,
          body.customerId ?? null,
          body.customerName,
          body.phone,
          joinAddressParts({
            postal: body.addressPostal,
            prefecture: body.addressPrefecture,
            city: body.addressCity,
            rest: body.addressRest,
          }),
          body.addressPostal,
          body.addressPrefecture,
          body.addressCity,
          body.addressRest,
          body.scheduledDate,
          body.startMinute ?? null,
          body.durationMin,
          "draft",
          body.notes,
          who.userId,
          now,
          now,
        )
        .run();
      return ok({ id });
    },
  );

  server.registerTool(
    "update_job",
    {
      description:
        "作業を更新する。指定したフィールドのみ更新される。status は登録済みのステータス名のみ指定できる。",
      inputSchema: updateJobSchema,
    },
    async (body: z.infer<typeof updateJobSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "job", "update"))) return deny("job", "update");
      const { id, ...rest } = body;
      const fields: Record<string, unknown> = {};
      if (rest.serviceId !== undefined) fields.service_id = rest.serviceId ?? null;
      if (rest.customerId !== undefined) fields.customer_id = rest.customerId ?? null;
      if (rest.customerName !== undefined) fields.customer_name = rest.customerName;
      if (rest.phone !== undefined) fields.phone = rest.phone;
      if (rest.address !== undefined) fields.address = rest.address;
      if (rest.addressPostal !== undefined) fields.address_postal = rest.addressPostal;
      if (rest.addressPrefecture !== undefined) fields.address_prefecture = rest.addressPrefecture;
      if (rest.addressCity !== undefined) fields.address_city = rest.addressCity;
      if (rest.addressRest !== undefined) fields.address_rest = rest.addressRest;
      if (rest.scheduledDate !== undefined) fields.scheduled_date = rest.scheduledDate;
      if (rest.startMinute !== undefined) fields.start_minute = rest.startMinute;
      if (rest.durationMin !== undefined) fields.duration_min = rest.durationMin;
      if (rest.notes !== undefined) fields.notes = rest.notes;
      if (rest.status !== undefined) {
        const st = (await env.DB.prepare(
          "SELECT id FROM job_statuses WHERE org_id = ? AND name = ?",
        )
          .bind(who.orgId, rest.status)
          .first()) as { id: string } | null;
        if (!st)
          return fail(
            `unknown_status: ステータス「${rest.status}」は存在しません。list_statuses で確認してください。`,
          );
        fields.status = rest.status;
      }
      const keys = Object.keys(fields);
      if (keys.length) {
        const setSql = keys.map((k) => `${k} = ?`).join(", ");
        await env.DB.prepare(
          `UPDATE jobs SET ${setSql}, updated_at = ? WHERE id = ? AND org_id = ?`,
        )
          .bind(...keys.map((k) => fields[k] as string | number | null), Date.now(), id, who.orgId)
          .run();
      }
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "delete_job",
    { description: "作業を削除（キャンセル扱い）する。", inputSchema: idSchema },
    async ({ id }) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "job", "delete"))) return deny("job", "delete");
      await env.DB.prepare(
        "UPDATE jobs SET status = 'cancelled', updated_at = ? WHERE id = ? AND org_id = ?",
      )
        .bind(Date.now(), id, who.orgId)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "assign_job",
    {
      description: "作業にスタッフを割り当てる。memberId は list_staff の user_id を指定する。",
      inputSchema: assignJobSchema,
    },
    async ({ id, memberId }: z.infer<typeof assignJobSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "assignment", "create")))
        return deny("assignment", "create");
      const job = (await env.DB.prepare("SELECT id FROM jobs WHERE id = ? AND org_id = ?")
        .bind(id, who.orgId)
        .first()) as { id: string } | null;
      if (!job) return fail("not_found: 指定された作業が見つかりません。");
      const member = (await env.DB.prepare(
        "SELECT userId FROM member WHERE organizationId = ? AND userId = ?",
      )
        .bind(who.orgId, memberId)
        .first()) as { userId: string } | null;
      if (!member)
        return fail(
          "member_not_found: 指定されたスタッフが見つかりません。list_staff で確認してください。",
        );
      await env.DB.prepare(
        "INSERT OR IGNORE INTO job_assignments (id, org_id, job_id, member_id, created_at) VALUES (?,?,?,?,?)",
      )
        .bind(crypto.randomUUID(), who.orgId, id, memberId, Date.now())
        .run();
      await env.DB.prepare("UPDATE jobs SET status = '割当日', updated_at = ? WHERE id = ?")
        .bind(Date.now(), id)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "unassign_job",
    {
      description: "作業からスタッフの割当を外す。memberId は list_staff の user_id を指定する。",
      inputSchema: assignJobSchema,
    },
    async ({ id, memberId }: z.infer<typeof assignJobSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "assignment", "delete")))
        return deny("assignment", "delete");
      await env.DB.prepare(
        "DELETE FROM job_assignments WHERE org_id = ? AND job_id = ? AND member_id = ?",
      )
        .bind(who.orgId, id, memberId)
        .run();
      await env.DB.prepare(
        "UPDATE jobs SET status = 'draft', updated_at = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM job_assignments WHERE job_id = ?)",
      )
        .bind(Date.now(), id, id)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_statuses",
    { description: "ジョブステータスの一覧を返す。", inputSchema: z.object({}) },
    async () => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "status", "read"))) return deny("status", "read");
      await ensureDefaultStatuses(env, who.orgId);
      return ok({ statuses: await listStatuses(env, who.orgId) });
    },
  );

  server.registerTool(
    "create_status",
    { description: "新しいジョブステータスを作成する。", inputSchema: statusSchema },
    async (body: z.infer<typeof statusSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "status", "create")))
        return deny("status", "create");
      const exists = (await env.DB.prepare(
        "SELECT id FROM job_statuses WHERE org_id = ? AND name = ?",
      )
        .bind(who.orgId, body.name)
        .first()) as { id: string } | null;
      if (exists) return fail("duplicate_status: 同じ名前のステータスがすでに存在します。");
      const maxOrder = (await env.DB.prepare(
        "SELECT COALESCE(MAX(sort_order), 0) + 1 AS o FROM job_statuses WHERE org_id = ?",
      )
        .bind(who.orgId)
        .first()) as { o: number };
      await env.DB.prepare(
        "INSERT INTO job_statuses (id, org_id, name, color, done, sort_order, created_at) VALUES (?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          who.orgId,
          body.name,
          body.color,
          body.done ? 1 : 0,
          maxOrder.o,
          Date.now(),
        )
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "delete_status",
    {
      description: "ジョブステータスを削除する。使用中のステータスは削除できない。",
      inputSchema: deleteStatusSchema,
    },
    async ({ name }: z.infer<typeof deleteStatusSchema>) => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      if (!(await can(env, who.userId, who.orgId, "status", "delete")))
        return deny("status", "delete");
      const usage = (await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM jobs WHERE org_id = ? AND status = ? AND status != 'キャンセル'",
      )
        .bind(who.orgId, name)
        .first()) as { c: number };
      if (usage.c > 0) return fail("status_in_use: 使用中のステータスは削除できません。");
      await env.DB.prepare("DELETE FROM job_statuses WHERE org_id = ? AND name = ?")
        .bind(who.orgId, name)
        .run();
      return ok({ ok: true });
    },
  );

  server.registerTool(
    "list_staff",
    { description: "組織のスタッフ（メンバー）の一覧とロールを返す。", inputSchema: z.object({}) },
    async () => {
      const who = identity();
      if (!who.ok) return fail(who.message);
      const rows = (await env.DB.prepare(
        "SELECT m.id AS member_id, m.role, m.userId AS user_id, u.name, u.email FROM member m JOIN user u ON u.id = m.userId WHERE m.organizationId = ? ORDER BY m.createdAt",
      )
        .bind(who.orgId)
        .all()) as { results: any[] };
      return ok({ staff: rows.results });
    },
  );

  return server;
}
