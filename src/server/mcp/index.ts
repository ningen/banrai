import { Hono } from "hono";
import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  OAuthError,
  OAuthErrorCode,
  oauthMetadataResponse,
  requireBearerAuth,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import type { AuthInfo } from "@modelcontextprotocol/server";
import type { Auth } from "../auth";
import { buildMcpServer } from "./tools";
import { buildAuthMetadata, createOAuthApp, MCP_PATH, MCP_SCOPE, sha256Hex } from "./oauth";

async function readParsedBody(request: Request): Promise<unknown> {
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) return undefined;
  const text = await request.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function createMcpApp(env: Env, auth: Auth) {
  const app = new Hono<{ Bindings: Env }>();

  app.all("/.well-known/*", async (c) => {
    const origin = new URL(c.req.url).origin;
    const res = oauthMetadataResponse(c.req.raw, {
      oauthMetadata: buildAuthMetadata(origin),
      resourceServerUrl: new URL(`${origin}${MCP_PATH}`),
      scopesSupported: [MCP_SCOPE],
      resourceName: "banrai (清掃事業者向け作業管理)",
    });
    return res ?? c.json({ error: "not_found" }, 404);
  });

  app.route("/", createOAuthApp(env, auth));

  const handler = createMcpHandler((ctx) => buildMcpServer(env, ctx));

  app.all("/mcp", async (c) => {
    const origin = new URL(c.req.url).origin;
    const mcpUrl = new URL(`${origin}${MCP_PATH}`);
    const verifier: OAuthTokenVerifier = {
      async verifyAccessToken(token: string): Promise<AuthInfo> {
        const row = (await env.DB.prepare(
          "SELECT * FROM mcp_tokens WHERE token_hash = ? AND kind = 'access'",
        )
          .bind(await sha256Hex(token))
          .first()) as {
          client_id: string;
          user_id: string;
          org_id: string;
          scope: string;
          resource: string;
          expires_at: number;
        } | null;
        if (!row) throw new OAuthError(OAuthErrorCode.InvalidToken, "unknown access token");
        if (row.expires_at < Date.now())
          throw new OAuthError(OAuthErrorCode.InvalidToken, "access token expired");
        const member = (await env.DB.prepare(
          "SELECT userId FROM member WHERE organizationId = ? AND userId = ?",
        )
          .bind(row.org_id, row.user_id)
          .first()) as { userId: string } | null;
        if (!member) throw new OAuthError(OAuthErrorCode.InvalidToken, "membership not found");
        const resource = new URL(row.resource);
        if (resource.origin !== mcpUrl.origin || resource.pathname !== mcpUrl.pathname) {
          throw new OAuthError(OAuthErrorCode.InvalidToken, "token audience mismatch");
        }
        return {
          token,
          clientId: row.client_id,
          scopes: row.scope.split(" "),
          expiresAt: Math.floor(row.expires_at / 1000),
          resource,
          extra: { userId: row.user_id, orgId: row.org_id },
        };
      },
    };
    const gate = requireBearerAuth({
      verifier,
      requiredScopes: [MCP_SCOPE],
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl),
    });
    const authInfo = await gate(c.req.raw);
    if (authInfo instanceof Response) return authInfo;

    return handler.fetch(c.req.raw, { authInfo, parsedBody: await readParsedBody(c.req.raw) });
  });

  return app;
}
