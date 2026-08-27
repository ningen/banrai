export interface Env {
  DB: D1Database;
  EMAIL: SendEmail;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  EMAIL_FROM: string;
  BOOTSTRAP_ADMIN_EMAIL?: string;
}
