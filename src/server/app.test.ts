import { env, exports } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import authSchemaSql from "../../migrations/0000_auth_schema.sql?raw";
import businessSchemaSql from "../../migrations/0001_services_jobs.sql?raw";
import servicesColorSql from "../../migrations/0002_services_color.sql?raw";
import customersSql from "../../migrations/0003_customers_and_billing.sql?raw";
import statusesSql from "../../migrations/0004_statuses_and_contacts.sql?raw";
import jobsAddressSql from "../../migrations/0005_jobs_address.sql?raw";
import jobsPositionSql from "../../migrations/0006_jobs_position.sql?raw";
import mcpSql from "../../migrations/0007_mcp.sql?raw";

const BASE = "https://example.com";

function splitStatements(sql: string): string[] {
  return sql
    .replace(/--[^\n]*/g, "\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

beforeAll(async () => {
  for (const sql of [
    authSchemaSql,
    businessSchemaSql,
    servicesColorSql,
    customersSql,
    statusesSql,
    jobsAddressSql,
    jobsPositionSql,
    mcpSql,
  ]) {
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

async function patch(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", Origin: BASE };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(new URL(path, BASE), {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

async function get(path: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { Origin: BASE };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(new URL(path, BASE), { headers });
}

async function postForm(
  path: string,
  body: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Origin: BASE,
  };
  if (cookie) headers.cookie = cookie;
  return exports.default.fetch(new URL(path, BASE), {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
    redirect: "manual",
  });
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64url(new Uint8Array(digest)) };
}

async function mcpClient(token: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(`${BASE}/mcp`), {
    authProvider: { token: async () => token },
    fetch: (input, init) => exports.default.fetch(new Request(input, init), init),
  });
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

async function authorizeAndGetToken(
  cookie: string,
  clientId: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const { verifier, challenge } = await pkcePair();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "https://client.example.com/callback",
    response_type: "code",
    scope: "banrai.mcp",
    state: "test-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource: `${BASE}/mcp`,
  });
  const consent = await get(`/authorize?${params.toString()}`, cookie);
  expect(consent.status).toBe(200);
  expect(await consent.text()).toContain("許可する");

  const approved = await postForm(`/authorize?${params.toString()}`, { approve: "1" }, cookie);
  expect(approved.status).toBe(302);
  const location = approved.headers.get("location")!;
  const code = new URL(location).searchParams.get("code")!;
  expect(code).toBeTruthy();
  expect(new URL(location).searchParams.get("state")).toBe("test-state");

  const tokenRes = await postForm("/token", {
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: "https://client.example.com/callback",
    code_verifier: verifier,
  });
  expect(tokenRes.status).toBe(200);
  const body = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  };
  expect(body.token_type).toBe("Bearer");
  expect(body.expires_in).toBeGreaterThan(0);
  expect(body.scope).toBe("banrai.mcp");
  return { accessToken: body.access_token, refreshToken: body.refresh_token };
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

  it("demo login seeds tenants and returns a working session", async () => {
    const res = await post("/api/demo/login", {});
    expect(res.status).toBe(200);
    const cookie = cookieFrom(res);

    const svc = await get("/api/services", cookie);
    expect(svc.status).toBe(200);
    const services = ((await svc.json()) as { services: { name: string }[] }).services;
    expect(services.map((s) => s.name)).toEqual(
      expect.arrayContaining(["エアコンクリーニング", "ハウスクリーニング", "レンジフード"]),
    );

    const jobsRes = await get("/api/jobs?from=2026-08-01&to=2027-12-31", cookie);
    expect(jobsRes.status).toBe(200);
    const jobs = ((await jobsRes.json()) as { jobs: unknown[] }).jobs;
    expect(jobs.length).toBeGreaterThanOrEqual(6);

    // 2回叩いても冪等 (新規シードされない)
    await post("/api/demo/login", {});
    const jobsAfter = (
      (await (await get("/api/jobs?from=2026-08-01&to=2027-12-31", cookie)).json()) as {
        jobs: unknown[];
      }
    ).jobs;
    expect(jobsAfter.length).toBe(jobs.length);
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

    // default statuses are seeded + custom status can be created
    res = await get("/api/statuses", ownerCookie);
    expect(res.status).toBe(200);
    const statuses = ((await res.json()) as { statuses: { name: string }[] }).statuses;
    expect(statuses.map((s) => s.name)).toEqual(
      expect.arrayContaining(["下書き", "割当日", "完了", "キャンセル"]),
    );

    res = await post(
      "/api/statuses",
      { name: "見積待ち", color: "#2F6B45", done: false },
      ownerCookie,
    );
    expect(res.status).toBe(200);

    // customer with multiple contacts
    res = await post(
      "/api/customers",
      {
        name: "山田 太郎",
        phones: ["090-1111-2222", "090-3333-4444"],
        emails: ["y@example.com", "y2@example.com"],
        addresses: [
          { postal: "100-0001", prefecture: "東京都", city: "千代田区", rest: "1-1" },
          { postal: "", prefecture: "大阪府", city: "大阪市", rest: "北区2-2" },
        ],
      },
      ownerCookie,
    );
    expect(res.status).toBe(200);

    // job (status defaults to 下書き; custom status can be applied)
    res = await post(
      "/api/jobs",
      { customerName: "山田 太郎", serviceId, scheduledDate: "2026-08-27" },
      ownerCookie,
    );
    expect(res.status).toBe(200);
    const jobId = ((await res.json()) as { id: string }).id;

    res = await patch(
      `/api/jobs/${jobId}`,
      {
        status: "見積待ち",
        phone: "090-1111-2222",
        addressPostal: "100-0001",
        addressPrefecture: "東京都",
        addressCity: "千代田区",
        addressRest: "丸の内1-1",
      },
      ownerCookie,
    );
    expect(res.status).toBe(200);

    res = await get("/api/jobs?from=2026-08-01&to=2026-08-31", ownerCookie);
    expect(res.status).toBe(200);
    const jobsAfter = (
      (await res.json()) as {
        jobs: { id: string; status: string; status_color: string }[];
      }
    ).jobs;
    const mine = jobsAfter.find((j) => j.id === jobId)!;
    expect(mine.status).toBe("見積待ち");
    expect(mine.status_color).toBe("#2F6B45");

    // unknown status is rejected
    res = await patch(`/api/jobs/${jobId}`, { status: "存在しない" }, ownerCookie);
    expect(res.status).toBe(400);

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
    expect(jobs[0]!.status).toBe("割当日");
  });

  describe("mcp server (OAuth 2.0 + streamable HTTP)", () => {
    const clientId = { value: "" };
    const ownerCookie = { value: "" };
    const memberCookie = { value: "" };
    const ownerToken = { value: "" };
    const ownerRefresh = { value: "" };
    const memberToken = { value: "" };
    const memberRefresh = { value: "" };

    beforeAll(async () => {
      const reg = await post("/register", {
        client_name: "テストエージェント",
        redirect_uris: ["https://client.example.com/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
        scope: "banrai.mcp",
      });
      expect(reg.status).toBe(201);
      const regBody = (await reg.json()) as { client_id: string };
      expect(regBody.client_id).toBeTruthy();
      clientId.value = regBody.client_id;

      // unauthenticated /authorize shows the login page, not a code
      const anon = await get(
        `/authorize?client_id=${clientId.value}&redirect_uri=${encodeURIComponent("https://client.example.com/callback")}&response_type=code&scope=banrai.mcp&code_challenge=abc&code_challenge_method=S256&resource=${encodeURIComponent(`${BASE}/mcp`)}`,
      );
      expect(anon.status).toBe(200);
      expect(await anon.text()).toContain("ログイン");

      const ownerLogin = await post("/api/demo/login", {});
      ownerCookie.value = cookieFrom(ownerLogin);

      const memberLogin = await post("/api/auth/sign-in/email", {
        email: "sato@example.com",
        password: "Demopass123!",
      });
      memberCookie.value = cookieFrom(memberLogin);
      const orgs = (await (
        await get("/api/auth/organization/list", memberCookie.value)
      ).json()) as {
        id: string;
      }[];
      await post(
        "/api/auth/organization/set-active",
        { organizationId: orgs[0]!.id },
        memberCookie.value,
      );

      const owner = await authorizeAndGetToken(ownerCookie.value, clientId.value);
      ownerToken.value = owner.accessToken;
      ownerRefresh.value = owner.refreshToken;
      const member = await authorizeAndGetToken(memberCookie.value, clientId.value);
      memberToken.value = member.accessToken;
      memberRefresh.value = member.refreshToken;
    });

    it("serves OAuth discovery metadata", async () => {
      const asMeta = await get("/.well-known/oauth-authorization-server");
      expect(asMeta.status).toBe(200);
      const body = (await asMeta.json()) as {
        authorization_endpoint: string;
        scopes_supported: string[];
      };
      expect(body.authorization_endpoint).toBe(`${BASE}/authorize`);
      expect(body.scopes_supported).toContain("banrai.mcp");

      const rsMeta = await get("/.well-known/oauth-protected-resource/mcp");
      expect(rsMeta.status).toBe(200);
      const rs = (await rsMeta.json()) as { resource: string; authorization_servers: string[] };
      expect(rs.resource).toBe(`${BASE}/mcp`);
      expect(rs.authorization_servers).toContain(BASE);
    });

    it("rejects /mcp without a Bearer token with a 401 challenge", async () => {
      const res = await exports.default.fetch(new URL("/mcp", BASE), { method: "POST" });
      expect(res.status).toBe(401);
      const www = res.headers.get("www-authenticate") ?? "";
      expect(www).toContain("Bearer");
      expect(www).toContain(`${BASE}/.well-known/oauth-protected-resource/mcp`);
    });

    it("lists tools and reads services with the owner token", async () => {
      const client = await mcpClient(ownerToken.value);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "list_services",
          "create_service",
          "list_customers",
          "list_jobs",
          "list_staff",
          "assign_job",
        ]),
      );

      const res = await client.callTool({ name: "list_services", arguments: {} });
      expect(res.isError).toBeFalsy();
      const text = res.content.map((c) => ("text" in c ? c.text : "")).join("\n");
      expect(text).toContain("エアコンクリーニング");
    });

    it("allows writes for the owner role", async () => {
      const client = await mcpClient(ownerToken.value);
      const created = await client.callTool({
        name: "create_service",
        arguments: { name: "MCP作成サービス", durationMin: 45, price: 5000 },
      });
      expect(created.isError).toBeFalsy();
      const text = created.content.map((c) => ("text" in c ? c.text : "")).join("\n");
      expect(text).toContain(`"id"`);
    });

    it("denies writes for a read-only member role", async () => {
      const client = await mcpClient(memberToken.value);
      const list = await client.callTool({ name: "list_services", arguments: {} });
      expect(list.isError).toBeFalsy();

      const create = await client.callTool({
        name: "create_service",
        arguments: { name: "ブロックMCP" },
      });
      expect(create.isError).toBe(true);
      const text = create.content.map((c) => ("text" in c ? c.text : "")).join("\n");
      expect(text).toContain("permission denied");
    });

    it("rotates refresh tokens and rejects reused grants", async () => {
      const rotated = await postForm("/token", {
        grant_type: "refresh_token",
        client_id: clientId.value,
        refresh_token: memberRefresh.value,
      });
      expect(rotated.status).toBe(200);
      const body = (await rotated.json()) as {
        access_token: string;
        refresh_token: string;
      };
      expect(body.access_token).toBeTruthy();
      expect(body.refresh_token).toBeTruthy();

      const client = await mcpClient(body.access_token);
      const res = await client.callTool({ name: "list_statuses", arguments: {} });
      expect(res.isError).toBeFalsy();

      const reuse = await postForm("/token", {
        grant_type: "refresh_token",
        client_id: clientId.value,
        refresh_token: memberRefresh.value,
      });
      expect(reuse.status).toBe(400);
    });

    it("rejects invalid client metadata at registration", async () => {
      const bad = await post("/register", {
        client_name: "bad",
        redirect_uris: ["http://insecure.example.com/cb"],
      });
      expect(bad.status).toBe(400);
      const badScope = await post("/register", {
        redirect_uris: ["https://client.example.com/callback"],
        scope: "admin",
      });
      expect(badScope.status).toBe(400);
    });

    it("rejects a wrong PKCE verifier at token exchange", async () => {
      const login = await post("/api/demo/login", {});
      const cookie = cookieFrom(login);
      const { challenge } = await pkcePair();
      const params = new URLSearchParams({
        client_id: clientId.value,
        redirect_uri: "https://client.example.com/callback",
        response_type: "code",
        scope: "banrai.mcp",
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      const approved = await postForm(`/authorize?${params.toString()}`, { approve: "1" }, cookie);
      const code = new URL(approved.headers.get("location")!).searchParams.get("code")!;
      const bad = await postForm("/token", {
        grant_type: "authorization_code",
        client_id: clientId.value,
        code,
        redirect_uri: "https://client.example.com/callback",
        code_verifier: "wrong-verifier",
      });
      expect(bad.status).toBe(400);
    });

    it("lists and revokes MCP connections from the API", async () => {
      const listRes = await get("/api/mcp/connections", ownerCookie.value);
      expect(listRes.status).toBe(200);
      const { connections } = (await listRes.json()) as {
        connections: { client_id: string; client_name: string; orgs: string }[];
      };
      expect(connections).toHaveLength(1);
      expect(connections[0]!.client_id).toBe(clientId.value);
      expect(connections[0]!.client_name).toBe("テストエージェント");
      expect(connections[0]!.orgs).toContain("デモ清掃サービス");

      // member sees only their own connection
      const memberList = await get("/api/mcp/connections", memberCookie.value);
      const memberConns = (await memberList.json()) as { connections: unknown[] };
      expect(memberConns.connections).toHaveLength(1);

      const del = (
        await exports.default.fetch(new URL(`/api/mcp/connections/${clientId.value}`, BASE), {
          method: "DELETE",
          headers: { Origin: BASE, cookie: ownerCookie.value },
        })
      ).status;
      expect(del).toBe(200);

      const after = await get("/api/mcp/connections", ownerCookie.value);
      const afterConns = (await after.json()) as { connections: unknown[] };
      expect(afterConns.connections).toHaveLength(0);

      // owner's access token is dead
      const dead = await exports.default.fetch(new URL("/mcp", BASE), {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken.value}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      expect(dead.status).toBe(401);

      // owner's refresh token is dead
      const deadRefresh = await postForm("/token", {
        grant_type: "refresh_token",
        client_id: clientId.value,
        refresh_token: ownerRefresh.value,
      });
      expect(deadRefresh.status).toBe(400);

      // member's own connection was untouched
      const memberClient = await mcpClient(memberToken.value);
      const kept = await memberClient.callTool({ name: "list_services", arguments: {} });
      expect(kept.isError).toBeFalsy();
    });
  });
});
