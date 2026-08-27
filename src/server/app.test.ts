import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import authSchemaSql from "../../migrations/0000_auth_schema.sql?raw";
import businessSchemaSql from "../../migrations/0001_services_jobs.sql?raw";
import servicesColorSql from "../../migrations/0002_services_color.sql?raw";

const BASE = "https://example.com";

function splitStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

beforeAll(async () => {
  for (const sql of [authSchemaSql, businessSchemaSql, servicesColorSql]) {
    for (const statement of splitStatements(sql)) {
      await env.DB.prepare(statement)
        .run()
        .catch((err: unknown) => {
          if (!String(err).includes("already exists")) throw err;
        });
    }
  }
});

function cookieFrom(res: Response): string {
  const set = res.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!set) throw new Error("no session cookie in response");
  return set.split(";")[0]!;
}

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", Origin: BASE };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(new URL(path, BASE), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function get(path: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { Origin: BASE };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(new URL(path, BASE), { headers });
}

describe("banrai worker", () => {
  it("responds on /healthz", async () => {
    const res = await get("/healthz");
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated business API access", async () => {
    const res = await get("/api/services");
    expect(res.status).toBe(401);
  });

  it("runs the full owner/staff workflow with dynamic roles", async () => {
    // owner signup + org
    let res = await post("/api/auth/sign-up/email", {
      email: "owner@test.local",
      password: "password123",
      name: "Owner",
    });
    expect(res.status).toBe(200);
    const ownerCookie = cookieFrom(res);

    res = await get("/api/auth/organization/list", ownerCookie);
    expect(res.status).toBe(200);

    res = await post(
      "/api/auth/organization/create",
      { name: "テスト清掃", slug: "test-clean" },
      ownerCookie,
    );
    expect(res.status).toBe(200);
    const org = (await res.json()) as {
      id: string;
      members: { id: string; role: string }[];
    };
    const ownerMember = org.members.find((m) => m.role === "owner")!;

    res = await post("/api/auth/organization/set-active", { organizationId: org.id }, ownerCookie);
    expect(res.status).toBe(200);

    // service
    res = await post(
      "/api/services",
      { name: "エアコンクリーニング", durationMin: 90 },
      ownerCookie,
    );
    expect(res.status).toBe(200);
    const serviceId = ((await res.json()) as { id: string }).id;

    // job
    res = await post(
      "/api/jobs",
      { customerName: "山田 太郎", serviceId, scheduledDate: "2026-08-27" },
      ownerCookie,
    );
    expect(res.status).toBe(200);
    const jobId = ((await res.json()) as { id: string }).id;

    // staff signup + invite + accept
    res = await post(
      "/api/auth/organization/invite-member",
      { email: "staff@test.local", role: "member" },
      ownerCookie,
    );
    expect(res.status).toBe(200);
    const invitation = (await res.json()) as { id: string };

    res = await post("/api/auth/sign-up/email", {
      email: "staff@test.local",
      password: "password123",
      name: "Staff",
    });
    expect(res.status).toBe(200);
    const staffCookie = cookieFrom(res);

    res = await post(
      "/api/auth/organization/accept-invitation",
      { invitationId: invitation.id },
      staffCookie,
    );
    expect(res.status).toBe(200);
    res = await post("/api/auth/organization/set-active", { organizationId: org.id }, staffCookie);
    expect(res.status).toBe(200);

    // staff (member) cannot create services yet
    res = await post("/api/services", { name: "ブロックテスト", durationMin: 60 }, staffCookie);
    expect(res.status).toBe(403);

    // create custom role (dynamic access control) and assign to staff
    res = await post(
      "/api/auth/organization/create-role",
      {
        role: "リーダー",
        permission: { job: ["read", "assign"], service: ["read"] },
        organizationId: org.id,
      },
      ownerCookie,
    );
    expect(res.status).toBe(200);

    res = await post(
      "/api/auth/organization/update-member-role",
      { memberId: ownerMember.id, role: "リーダー", organizationId: org.id },
      ownerCookie,
    );
    // owner is the only owner; demotion is refused by the organization plugin
    expect(res.status).not.toBe(200);

    // assign job to staff via staff member record
    const listRes = await get(
      `/api/auth/organization/list-members?organizationId=${org.id}`,
      ownerCookie,
    );
    const members = (
      (await listRes.json()) as {
        members: { id: string; user: { id: string; email: string }; role: string }[];
      }
    ).members;
    const staffMember = members.find((m) => m.user && m.user.email === "staff@test.local")!;
    const staffUserId: string = staffMember.user.id;

    res = await post(
      "/api/auth/organization/update-member-role",
      { memberId: staffMember.id, role: "リーダー", organizationId: org.id },
      ownerCookie,
    );
    expect(res.status).toBe(200);

    res = await post(`/api/jobs/${jobId}/assign`, { memberId: staffUserId }, ownerCookie);
    expect(res.status).toBe(200);

    // staff sees assigned job via member filter
    res = await get(`/api/jobs?from=2026-08-01&to=2026-08-31&memberId=${staffUserId}`, staffCookie);
    expect(res.status).toBe(200);
    const jobs = (
      (await res.json()) as { jobs: { id: string; status: string; assignments: unknown[] }[] }
    ).jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe(jobId);
    expect(jobs[0]!.status).toBe("assigned");
  });
});
