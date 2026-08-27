import { Hono } from "hono";
import { createAuth, type Auth } from "./server/auth";
import { createApi } from "./server/routes";
import type { Env } from "./server/types";

let cached: { env: Env; auth: Auth } | null = null;

function getAuth(env: Env): Auth {
  if (!cached || cached.env !== env) {
    cached = { env, auth: createAuth(env) };
  }
  return cached.auth;
}

function buildApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  const auth = getAuth(env);
  const api = createApi(auth);

  app.on(["GET", "POST", "PUT", "PATCH", "DELETE"], "/api/auth/*", (c) =>
    auth.handler(c.req.raw)
  );

  app.route("/api", api);
  app.get("/healthz", (c) => c.text("ok"));

  return app;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api") && url.pathname !== "/healthz") {
      return env.ASSETS.fetch(request);
    }
    const app = buildApp(env);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
