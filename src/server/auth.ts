import { betterAuth } from "better-auth";
import { buildAuthPlugins, buildEmailConfig } from "./plugins";

export function createAuth(env: Env) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    ...buildEmailConfig(env),
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (env.BOOTSTRAP_ADMIN_EMAIL && user.email === env.BOOTSTRAP_ADMIN_EMAIL) {
              return { data: { ...user, role: "admin" } };
            }
            return { data: user };
          },
        },
      },
    },
    plugins: buildAuthPlugins(env),
  });
}

export type Auth = ReturnType<typeof createAuth>;
