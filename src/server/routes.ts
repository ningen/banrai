import { Hono, type Context } from "hono";
import { z } from "zod";
import type { Auth } from "./auth";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const serviceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().default(""),
  durationMin: z.number().int().min(15).max(720).optional().default(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .default(""),
  price: z.number().int().min(0).max(100_000_000).optional().default(0),
  options: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        price: z.number().int().min(0).max(100_000_000),
      }),
    )
    .max(30)
    .optional()
    .default([]),
});

const customerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(40).optional().default(""),
  email: z.string().max(120).optional().default(""),
  address: z.string().max(300).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

const jobSchema = z.object({
  serviceId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().min(1).max(100),
  phone: z.string().max(40).optional().default(""),
  address: z.string().max(300).optional().default(""),
  scheduledDate: z.string().regex(DATE_RE),
  startMinute: z
    .number()
    .int()
    .min(0)
    .max(23 * 60)
    .optional()
    .nullable(),
  durationMin: z.number().int().min(15).max(720).optional().default(60),
  notes: z.string().max(1000).optional().default(""),
  status: z.enum(["draft", "assigned", "done", "cancelled"]).optional(),
});

const assignSchema = z.object({
  memberId: z.string().min(1),
});

type Ctx = Context<{ Bindings: Env }>;
type Guarded = {
  session: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;
  orgId: string;
};
import { ensureDemo, DEMO_LOGIN } from "./demo";

async function parseBody<T>(c: Ctx, schema: z.ZodType<T>): Promise<T | Response> {
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  return parsed.data;
}

export function createApi(auth: Auth) {
  const api = new Hono<{ Bindings: Env }>();

  api.post("/demo/login", async (c) => {
    const { orgId } = await ensureDemo(c.env, auth);
    const origin = new URL(c.req.url).origin;

    const signIn = await auth.handler(
      new Request(`${origin}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: DEMO_LOGIN.email, password: DEMO_LOGIN.password }),
      }),
    );
    if (!signIn.ok) return c.json({ error: "demo_signin_failed" }, 502);

    const cookies = signIn.headers.getSetCookie();
    const cookieStr = cookies.map((x: string) => x.split(";")[0]!).join("; ");
    const active = await auth.handler(
      new Request(`${origin}/api/auth/organization/set-active`, {
        method: "POST",
        headers: { "content-type": "application/json", origin, cookie: cookieStr },
        body: JSON.stringify({ organizationId: orgId }),
      }),
    );

    const res = Response.json({ ok: true });
    for (const cc of cookies) res.headers.append("set-cookie", cc);
    for (const cc of active.headers.getSetCookie()) res.headers.append("set-cookie", cc);
    return res;
  });

  async function guard(c: Ctx): Promise<Guarded | Response> {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "unauthorized" }, 401);
    const orgId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    if (!orgId) return c.json({ error: "no_active_organization" }, 409);
    return { session, orgId };
  }

  async function can(c: Ctx, permissions: Record<string, string[]>): Promise<boolean> {
    const result = await auth.api.hasPermission({
      headers: c.req.raw.headers,
      body: { permissions },
    });
    return result.success;
  }

  api.get("/services", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { service: ["read"] }))) return c.json({ error: "forbidden" }, 403);

    const rows = (await c.env.DB.prepare(
      "SELECT * FROM services WHERE org_id = ? AND active = 1 ORDER BY created_at",
    )
      .bind(g.orgId)
      .all()) as any;
    return c.json({
      services: rows.results.map((r: any) => ({
        ...r,
        options: JSON.parse((r.options as string | null) ?? "[]"),
        price: r.price ?? 0,
      })),
    });
  });

  api.post("/services", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { service: ["create"] }))) return c.json({ error: "forbidden" }, 403);

    const body = await parseBody(c, serviceSchema);
    if (body instanceof Response) return body;

    const now = Date.now();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO services (id, org_id, name, description, duration_min, color, price, options, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)",
    )
      .bind(
        id,
        g.orgId,
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
    return c.json({ id });
  });

  api.patch("/services/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { service: ["update"] }))) return c.json({ error: "forbidden" }, 403);

    const body = await parseBody(c, serviceSchema.partial());
    if (body instanceof Response) return body;
    const { id } = c.req.param();

    if (body.name !== undefined)
      await c.env.DB.prepare("UPDATE services SET name = ? WHERE id = ? AND org_id = ?")
        .bind(body.name, id, g.orgId)
        .run();
    if (body.description !== undefined)
      await c.env.DB.prepare("UPDATE services SET description = ? WHERE id = ? AND org_id = ?")
        .bind(body.description, id, g.orgId)
        .run();
    if (body.durationMin !== undefined)
      await c.env.DB.prepare("UPDATE services SET duration_min = ? WHERE id = ? AND org_id = ?")
        .bind(body.durationMin, id, g.orgId)
        .run();
    if (body.color !== undefined)
      await c.env.DB.prepare("UPDATE services SET color = ? WHERE id = ? AND org_id = ?")
        .bind(body.color, id, g.orgId)
        .run();
    if (body.price !== undefined)
      await c.env.DB.prepare("UPDATE services SET price = ? WHERE id = ? AND org_id = ?")
        .bind(body.price, id, g.orgId)
        .run();
    if (body.options !== undefined)
      await c.env.DB.prepare("UPDATE services SET options = ? WHERE id = ? AND org_id = ?")
        .bind(JSON.stringify(body.options), id, g.orgId)
        .run();
    await c.env.DB.prepare("UPDATE services SET updated_at = ? WHERE id = ? AND org_id = ?")
      .bind(Date.now(), id, g.orgId)
      .run();
    return c.json({ ok: true });
  });

  api.delete("/services/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { service: ["delete"] }))) return c.json({ error: "forbidden" }, 403);
    const { id } = c.req.param();
    await c.env.DB.prepare("UPDATE services SET active = 0 WHERE id = ? AND org_id = ?")
      .bind(id, g.orgId)
      .run();
    return c.json({ ok: true });
  });

  api.get("/jobs", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { job: ["read"] }))) return c.json({ error: "forbidden" }, 403);

    const from = c.req.query("from") ?? "";
    const to = c.req.query("to") ?? "";
    const memberId = c.req.query("memberId");

    let sql =
      "SELECT j.*, s.name AS service_name, s.color AS service_color FROM jobs j LEFT JOIN services s ON s.id = j.service_id WHERE j.org_id = ?";
    const binds: string[] = [g.orgId];
    if (from) {
      sql += " AND j.scheduled_date >= ?";
      binds.push(from);
    }
    if (to) {
      sql += " AND j.scheduled_date <= ?";
      binds.push(to);
    }
    sql += " ORDER BY j.scheduled_date, j.start_minute";

    const rows = (await c.env.DB.prepare(sql)
      .bind(...binds)
      .all()) as any;

    const jobIds = rows.results.map((j: any) => j.id);
    const allAssignments = jobIds.length
      ? (
          await c.env.DB.prepare(
            "SELECT * FROM job_assignments WHERE org_id = ? AND job_id IN (" +
              jobIds.map(() => "?").join(",") +
              ")",
          )
            .bind(g.orgId, ...jobIds)
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
    return c.json({
      jobs: jobs.map((j: any) => ({ ...j, assignments: assignmentsByJob.get(j.id) ?? [] })),
    });
  });

  api.post("/jobs", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { job: ["create"] }))) return c.json({ error: "forbidden" }, 403);

    const body = await parseBody(c, jobSchema);
    if (body instanceof Response) return body;

    const now = Date.now();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO jobs (id, org_id, service_id, customer_id, customer_name, phone, address, scheduled_date, start_minute, duration_min, status, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        g.orgId,
        body.serviceId ?? null,
        body.customerId ?? null,
        body.customerName,
        body.phone,
        body.address,
        body.scheduledDate,
        body.startMinute ?? null,
        body.durationMin,
        "draft",
        body.notes,
        g.session.user.id,
        now,
        now,
      )
      .run();
    return c.json({ id });
  });

  api.patch("/jobs/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { job: ["update"] }))) return c.json({ error: "forbidden" }, 403);

    const body = await parseBody(c, jobSchema.partial());
    if (body instanceof Response) return body;
    const { id } = c.req.param();

    const fields: Record<string, unknown> = {};
    if (body.serviceId !== undefined) fields.service_id = body.serviceId ?? null;
    if (body.customerId !== undefined) fields.customer_id = body.customerId ?? null;
    if (body.customerName !== undefined) fields.customer_name = body.customerName;
    if (body.phone !== undefined) fields.phone = body.phone;
    if (body.address !== undefined) fields.address = body.address;
    if (body.scheduledDate !== undefined) fields.scheduled_date = body.scheduledDate;
    if (body.startMinute !== undefined) fields.start_minute = body.startMinute;
    if (body.durationMin !== undefined) fields.duration_min = body.durationMin;
    if (body.notes !== undefined) fields.notes = body.notes;
    if (body.status !== undefined) fields.status = body.status;

    const keys = Object.keys(fields);
    if (keys.length) {
      const setSql = keys.map((k) => `${k} = ?`).join(", ");
      await c.env.DB.prepare(
        `UPDATE jobs SET ${setSql}, updated_at = ? WHERE id = ? AND org_id = ?`,
      )
        .bind(...keys.map((k) => fields[k] as string | number | null), Date.now(), id, g.orgId)
        .run();
    }
    return c.json({ ok: true });
  });

  api.delete("/jobs/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { job: ["delete"] }))) return c.json({ error: "forbidden" }, 403);
    const { id } = c.req.param();
    await c.env.DB.prepare(
      "UPDATE jobs SET status = 'cancelled', updated_at = ? WHERE id = ? AND org_id = ?",
    )
      .bind(Date.now(), id, g.orgId)
      .run();
    return c.json({ ok: true });
  });

  api.post("/jobs/:id/assign", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { assignment: ["create"] }))) return c.json({ error: "forbidden" }, 403);

    const body = await parseBody(c, assignSchema);
    if (body instanceof Response) return body;
    const { id } = c.req.param();

    const job = (await c.env.DB.prepare("SELECT id FROM jobs WHERE id = ? AND org_id = ?")
      .bind(id, g.orgId)
      .first()) as any;
    if (!job) return c.json({ error: "not_found" }, 404);

    const member = (await c.env.DB.prepare(
      "SELECT userId FROM member WHERE organizationId = ? AND userId = ?",
    )
      .bind(g.orgId, body.memberId)
      .first()) as any;
    if (!member) return c.json({ error: "member_not_found" }, 404);

    await c.env.DB.prepare(
      "INSERT OR IGNORE INTO job_assignments (id, org_id, job_id, member_id, created_at) VALUES (?,?,?,?,?)",
    )
      .bind(crypto.randomUUID(), g.orgId, id, body.memberId, Date.now())
      .run();
    await c.env.DB.prepare("UPDATE jobs SET status = 'assigned', updated_at = ? WHERE id = ?")
      .bind(Date.now(), id)
      .run();
    return c.json({ ok: true });
  });

  api.delete("/jobs/:id/assign/:memberId", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { assignment: ["delete"] }))) return c.json({ error: "forbidden" }, 403);
    const { id, memberId } = c.req.param();
    await c.env.DB.prepare(
      "DELETE FROM job_assignments WHERE org_id = ? AND job_id = ? AND member_id = ?",
    )
      .bind(g.orgId, id, memberId)
      .run();
    await c.env.DB.prepare(
      "UPDATE jobs SET status = 'draft', updated_at = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM job_assignments WHERE job_id = ?)",
    )
      .bind(Date.now(), id, id)
      .run();
    return c.json({ ok: true });
  });

  api.get("/invitations", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { invitation: ["create"] }))) return c.json({ error: "forbidden" }, 403);
    const list = await auth.api.listInvitations({
      query: { organizationId: g.orgId },
      headers: c.req.raw.headers,
    });
    return c.json({ invitations: list });
  });

  api.get("/org-roles", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { ac: ["read"] }))) return c.json({ error: "forbidden" }, 403);
    const rows = (await c.env.DB.prepare(
      "SELECT role, permission FROM organizationRole WHERE organizationId = ? ORDER BY createdAt",
    )
      .bind(g.orgId)
      .all()) as any;
    return c.json({
      roles: rows.results.map((r: any) => ({
        role: r.role,
        permission: JSON.parse(r.permission || "{}"),
      })),
    });
  });

  api.get("/customers", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { customer: ["read"] }))) return c.json({ error: "forbidden" }, 403);
    const rows = (await c.env.DB.prepare("SELECT * FROM customers WHERE org_id = ? ORDER BY name")
      .bind(g.orgId)
      .all()) as any;
    return c.json({ customers: rows.results });
  });

  api.post("/customers", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { customer: ["create"] }))) return c.json({ error: "forbidden" }, 403);
    const body = await parseBody(c, customerSchema);
    if (body instanceof Response) return body;
    const now = Date.now();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO customers (id, org_id, name, phone, email, address, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
    )
      .bind(id, g.orgId, body.name, body.phone, body.email, body.address, body.notes, now, now)
      .run();
    return c.json({ id });
  });

  api.patch("/customers/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { customer: ["update"] }))) return c.json({ error: "forbidden" }, 403);
    const body = await parseBody(c, customerSchema.partial());
    if (body instanceof Response) return body;
    const { id } = c.req.param();
    const fields: Record<string, unknown> = { ...body };
    const keys = Object.keys(fields);
    if (keys.length) {
      const setSql = keys.map((k) => `${k} = ?`).join(", ");
      await c.env.DB.prepare(
        `UPDATE customers SET ${setSql}, updated_at = ? WHERE id = ? AND org_id = ?`,
      )
        .bind(...keys.map((k) => fields[k] as string | number | null), Date.now(), id, g.orgId)
        .run();
    }
    return c.json({ ok: true });
  });

  api.delete("/customers/:id", async (c) => {
    const g = await guard(c);
    if (g instanceof Response) return g;
    if (!(await can(c, { customer: ["delete"] }))) return c.json({ error: "forbidden" }, 403);
    const { id } = c.req.param();
    await c.env.DB.prepare(
      "UPDATE jobs SET customer_id = NULL WHERE customer_id = ? AND org_id = ?",
    )
      .bind(id, g.orgId)
      .run();
    await c.env.DB.prepare("DELETE FROM customers WHERE id = ? AND org_id = ?")
      .bind(id, g.orgId)
      .run();
    return c.json({ ok: true });
  });

  return api;
}
