import { Hono, type Context } from "hono";
import type { Auth } from "../auth";

export const MCP_SCOPE = "banrai.mcp";
export const MCP_PATH = "/mcp";
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

type Ctx = Context<{ Bindings: Env }>;

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function pkceVerify(verifier: string, challenge: string): Promise<boolean> {
  if (!verifier || !challenge) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest)) === challenge;
}

function page(title: string, body: string): Response {
  return new Response(
    `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} - banrai</title>
<style>
*{box-sizing:border-box;margin:0}
body{font-family:ui-sans-serif,system-ui,"Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;background:#f4f6f8;color:#0f172a;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgb(0 0 0 / .06);padding:28px;width:100%;max-width:420px}
h1{font-size:18px;margin-bottom:16px}
p{font-size:14px;line-height:1.7;color:#334155;margin-bottom:12px}
label{display:block;font-size:13px;font-weight:600;margin:12px 0 4px}
input{width:100%;padding:9px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
button{margin-top:16px;width:100%;padding:10px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
button.ghost{background:#fff;color:#475569;border:1px solid #cbd5e1;margin-top:8px}
.error{color:#dc2626;font-size:13px;margin-top:8px}
.meta{font-size:13px;color:#64748b}
code{background:#f1f5f9;padding:1px 5px;border-radius:5px;font-size:12px}
</style></head><body><div class="card">${body}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function errorPage(title: string, message: string): Response {
  return page(title, `<h1>${title}</h1><p>${message}</p>`);
}

function loginPage(nextUrl: string): Response {
  return page(
    "ログイン",
    `<h1>banrai にログイン</h1>
<p class="meta">AI エージェントを接続するには、まずログインしてください。</p>
<form id="f">
  <label for="email">メールアドレス</label><input id="email" name="email" type="email" required autocomplete="email">
  <label for="password">パスワード</label><input id="password" name="password" type="password" required autocomplete="current-password">
  <div class="error" id="err"></div>
  <button type="submit">ログイン</button>
</form>
<script>
document.getElementById("f").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const res = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
  });
  if (!res.ok) {
    document.getElementById("err").textContent = "メールアドレスまたはパスワードが違います";
    return;
  }
  location.href = ${JSON.stringify(nextUrl)};
});
</script>`,
  );
}

function consentPage(input: {
  clientName: string;
  userEmail: string;
  orgName: string;
  formAction: string;
}): Response {
  const { clientName, userEmail, orgName, formAction } = input;
  return page(
    "接続の許可",
    `<h1>AI エージェントの接続</h1>
<p><code>${clientName}</code> が、あなたの代理として banrai のデータにアクセスしようとしています。</p>
<p class="meta">アカウント: <strong>${userEmail}</strong><br>組織: <strong>${orgName}</strong></p>
<p class="meta">接続中の AI エージェントに許可される操作は、あなたのロールで許可されている範囲に限られます。</p>
<form method="post" action="${formAction}">
  <button type="submit" name="approve" value="1">許可する</button>
  <button type="submit" class="ghost" name="deny" value="1">拒否する</button>
</form>`,
  );
}

async function clientById(
  env: Env,
  clientId: string,
): Promise<{ id: string; name: string; redirect_uris: string[]; scopes: string[] } | null> {
  const row = (await env.DB.prepare(
    "SELECT id, name, redirect_uris, scopes FROM mcp_clients WHERE id = ?",
  )
    .bind(clientId)
    .first()) as { id: string; name: string; redirect_uris: string; scopes: string } | null;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    redirect_uris: JSON.parse(row.redirect_uris),
    scopes: JSON.parse(row.scopes),
  };
}

function isHttpsOrLocalhost(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    if (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1")
    )
      return true;
    return false;
  } catch {
    return false;
  }
}

type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  state: string;
  scope: string;
  codeChallenge: string;
  resource: string;
};

async function parseAuthorize(
  c: Ctx,
  search: URLSearchParams,
): Promise<{ ok: true; p: AuthorizeParams } | { ok: false; title: string; message: string }> {
  const origin = new URL(c.req.url).origin;
  const clientId = search.get("client_id") ?? "";
  const client = await clientById(c.env, clientId);
  if (!client)
    return {
      ok: false,
      title: "接続できません",
      message: "クライアントが見つかりません (invalid_client)。",
    };
  if (search.get("response_type") !== "code") {
    return {
      ok: false,
      title: "接続できません",
      message: "response_type=code のみサポートしています (unsupported_response_type)。",
    };
  }
  const redirectUri = search.get("redirect_uri") ?? "";
  if (!client.redirect_uris.includes(redirectUri) || !isHttpsOrLocalhost(redirectUri)) {
    return {
      ok: false,
      title: "接続できません",
      message: "リダイレクト URI が登録されていません (invalid_request)。",
    };
  }
  const codeChallenge = search.get("code_challenge") ?? "";
  if (!codeChallenge || search.get("code_challenge_method") !== "S256") {
    return {
      ok: false,
      title: "接続できません",
      message: "PKCE (S256) が必須です (invalid_request)。",
    };
  }
  const scope = search.get("scope") ?? MCP_SCOPE;
  if (scope !== MCP_SCOPE || !client.scopes.includes(MCP_SCOPE)) {
    return {
      ok: false,
      title: "接続できません",
      message: "サポートされていないスコープです (invalid_scope)。",
    };
  }
  const resource = search.get("resource");
  if (resource && !(resource.replace(/\/+$/, "") === `${origin}${MCP_PATH}`)) {
    return {
      ok: false,
      title: "接続できません",
      message: "対象リソースがこのサーバーではありません (invalid_target)。",
    };
  }
  return {
    ok: true,
    p: {
      clientId,
      redirectUri,
      state: search.get("state") ?? "",
      scope,
      codeChallenge,
      resource: resource ?? `${origin}${MCP_PATH}`,
    },
  };
}

async function issueCode(
  env: Env,
  p: AuthorizeParams,
  userId: string,
  orgId: string,
): Promise<string> {
  const code = randomToken();
  await env.DB.prepare(
    "INSERT INTO mcp_auth_codes (code_hash, client_id, user_id, org_id, redirect_uri, code_challenge, scope, resource, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
  )
    .bind(
      await sha256Hex(code),
      p.clientId,
      userId,
      orgId,
      p.redirectUri,
      p.codeChallenge,
      p.scope,
      p.resource,
      Date.now() + AUTH_CODE_TTL_MS,
      Date.now(),
    )
    .run();
  return code;
}

function redirectWithCode(redirectUri: string, code: string, state: string): Response {
  const url = new URL(redirectUri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  return Response.redirect(url.toString(), 302);
}

async function issueTokens(
  env: Env,
  clientId: string,
  userId: string,
  orgId: string,
  scope: string,
  resource: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const now = Date.now();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO mcp_tokens (token_hash, kind, client_id, user_id, org_id, scope, resource, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      await sha256Hex(accessToken),
      "access",
      clientId,
      userId,
      orgId,
      scope,
      resource,
      now + ACCESS_TOKEN_TTL_MS,
      now,
    ),
    env.DB.prepare(
      "INSERT INTO mcp_tokens (token_hash, kind, client_id, user_id, org_id, scope, resource, expires_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).bind(
      await sha256Hex(refreshToken),
      "refresh",
      clientId,
      userId,
      orgId,
      scope,
      resource,
      now + REFRESH_TOKEN_TTL_MS,
      now,
    ),
  ]);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_MS / 1000 };
}

export function buildAuthMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/authorize`,
    token_endpoint: `${origin}/token`,
    registration_endpoint: `${origin}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [MCP_SCOPE],
    authorization_response_iss_parameter_supported: false,
  };
}

export function createOAuthApp(env: Env, auth: Auth) {
  const app = new Hono<{ Bindings: Env }>();

  app.post("/register", async (c) => {
    const body = (await c.req.json().catch(() => null)) as {
      client_name?: string;
      redirect_uris?: unknown;
      grant_types?: unknown;
      response_types?: unknown;
      token_endpoint_auth_method?: unknown;
      scope?: unknown;
    } | null;
    if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "redirect_uris must be a non-empty array",
        },
        400,
      );
    }
    const redirectUris = body.redirect_uris.filter(
      (u): u is string => typeof u === "string" && isHttpsOrLocalhost(u),
    );
    if (redirectUris.length !== body.redirect_uris.length) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "redirect_uris must be https or http://localhost",
        },
        400,
      );
    }
    const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code"];
    if (grantTypes.some((g) => g !== "authorization_code" && g !== "refresh_token")) {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "grant_types must be authorization_code and/or refresh_token",
        },
        400,
      );
    }
    const responseTypes = Array.isArray(body.response_types) ? body.response_types : ["code"];
    if (responseTypes.some((r) => r !== "code")) {
      return c.json(
        { error: "invalid_client_metadata", error_description: "response_types must be code" },
        400,
      );
    }
    const tokenEndpointAuthMethod =
      typeof body.token_endpoint_auth_method === "string"
        ? body.token_endpoint_auth_method
        : "none";
    if (tokenEndpointAuthMethod !== "none") {
      return c.json(
        {
          error: "invalid_client_metadata",
          error_description: "only public clients (token_endpoint_auth_method=none) are supported",
        },
        400,
      );
    }
    const scope = typeof body.scope === "string" ? body.scope : MCP_SCOPE;
    if (scope !== MCP_SCOPE) {
      return c.json(
        { error: "invalid_client_metadata", error_description: `unsupported scope: ${scope}` },
        400,
      );
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO mcp_clients (id, name, redirect_uris, scopes, created_at) VALUES (?,?,?,?,?)",
    )
      .bind(
        id,
        body.client_name?.slice(0, 100) || "MCP client",
        JSON.stringify(redirectUris),
        JSON.stringify([scope]),
        Date.now(),
      )
      .run();
    return c.json(
      {
        client_id: id,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: body.client_name?.slice(0, 100) || "MCP client",
        redirect_uris: redirectUris,
        grant_types: grantTypes,
        response_types: responseTypes,
        token_endpoint_auth_method: "none",
        scope,
      },
      201,
    );
  });

  app.get("/authorize", async (c) => {
    const parsed = await parseAuthorize(c, new URL(c.req.url).searchParams);
    if (!parsed.ok) return errorPage(parsed.title, parsed.message);

    const next = c.req.url.slice(c.req.url.indexOf("/authorize"));

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return loginPage(next);

    const orgId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    if (!orgId) {
      return errorPage(
        "組織が選択されていません",
        "アプリで所属組織を選択してから、もう一度お試しください。",
      );
    }
    const org = (await c.env.DB.prepare("SELECT name FROM organization WHERE id = ?")
      .bind(orgId)
      .first()) as { name: string } | null;
    const client = await clientById(c.env, parsed.p.clientId);
    return consentPage({
      clientName: client?.name ?? "不明なクライアント",
      userEmail: session.user.email,
      orgName: org?.name ?? orgId,
      formAction: next,
    });
  });

  app.post("/authorize", async (c) => {
    const form = await c.req.formData().catch(() => null);
    if (!form) return errorPage("接続できません", "リクエストを読み取れませんでした。");
    const params = new URLSearchParams(new URL(c.req.url).searchParams);
    for (const [k, v] of form.entries()) params.set(k, String(v));
    const parsed = await parseAuthorize(c, params);
    if (!parsed.ok) return errorPage(parsed.title, parsed.message);
    if (form.get("deny")) {
      const url = new URL(parsed.p.redirectUri);
      url.searchParams.set("error", "access_denied");
      if (parsed.p.state) url.searchParams.set("state", parsed.p.state);
      return Response.redirect(url.toString(), 302);
    }
    if (!form.get("approve"))
      return errorPage("接続できません", "承認操作を確認できませんでした。");

    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return loginPage(c.req.url.slice(c.req.url.indexOf("/authorize")));
    const orgId = (session.session as { activeOrganizationId?: string | null })
      .activeOrganizationId;
    if (!orgId)
      return errorPage(
        "組織が選択されていません",
        "アプリで所属組織を選択してから、もう一度お試しください。",
      );

    const code = await issueCode(c.env, parsed.p, session.user.id, orgId);
    return redirectWithCode(parsed.p.redirectUri, code, parsed.p.state);
  });

  app.post("/token", async (c) => {
    const form = await c.req.formData().catch(() => null);
    if (!form) return c.json({ error: "invalid_request" }, 400);
    const grantType = String(form.get("grant_type") ?? "");

    if (grantType === "authorization_code") {
      const clientId = String(form.get("client_id") ?? "");
      const code = String(form.get("code") ?? "");
      const redirectUri = String(form.get("redirect_uri") ?? "");
      const codeVerifier = String(form.get("code_verifier") ?? "");
      const client = await clientById(c.env, clientId);
      if (!client || !client.redirect_uris.includes(redirectUri)) {
        return c.json({ error: "invalid_client" }, 401);
      }
      const row = (await c.env.DB.prepare(
        "SELECT * FROM mcp_auth_codes WHERE code_hash = ? AND client_id = ?",
      )
        .bind(await sha256Hex(code), clientId)
        .first()) as {
        user_id: string;
        org_id: string;
        redirect_uri: string;
        code_challenge: string;
        scope: string;
        resource: string;
        expires_at: number;
      } | null;
      if (
        !row ||
        row.redirect_uri !== redirectUri ||
        row.expires_at < Date.now() ||
        !(await pkceVerify(codeVerifier, row.code_challenge))
      ) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      await c.env.DB.prepare("DELETE FROM mcp_auth_codes WHERE code_hash = ?")
        .bind(await sha256Hex(code))
        .run();
      const tokens = await issueTokens(
        c.env,
        clientId,
        row.user_id,
        row.org_id,
        row.scope,
        row.resource,
      );
      return c.json({
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: row.scope,
      });
    }

    if (grantType === "refresh_token") {
      const clientId = String(form.get("client_id") ?? "");
      const refreshToken = String(form.get("refresh_token") ?? "");
      const client = await clientById(c.env, clientId);
      if (!client) return c.json({ error: "invalid_client" }, 401);
      const row = (await c.env.DB.prepare(
        "SELECT * FROM mcp_tokens WHERE token_hash = ? AND kind = 'refresh'",
      )
        .bind(await sha256Hex(refreshToken))
        .first()) as {
        client_id: string;
        user_id: string;
        org_id: string;
        scope: string;
        resource: string;
        expires_at: number;
      } | null;
      if (!row || row.client_id !== clientId || row.expires_at < Date.now()) {
        return c.json({ error: "invalid_grant" }, 400);
      }
      await c.env.DB.prepare("DELETE FROM mcp_tokens WHERE token_hash = ?")
        .bind(await sha256Hex(refreshToken))
        .run();
      const tokens = await issueTokens(
        c.env,
        clientId,
        row.user_id,
        row.org_id,
        row.scope,
        row.resource,
      );
      return c.json({
        access_token: tokens.accessToken,
        token_type: "Bearer",
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: row.scope,
      });
    }

    return c.json({ error: "unsupported_grant_type" }, 400);
  });

  return app;
}
