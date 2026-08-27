export const DEFAULT_STATUSES: { name: string; color: string; done: boolean; sortOrder: number }[] =
  [
    { name: "下書き", color: "#64748b", done: false, sortOrder: 1 },
    { name: "割当日", color: "#2753e4", done: false, sortOrder: 2 },
    { name: "完了", color: "#0e9f6e", done: true, sortOrder: 3 },
    { name: "キャンセル", color: "#c93f3f", done: false, sortOrder: 4 },
  ];

export async function ensureDefaultStatuses(env: Env, orgId: string): Promise<void> {
  const row = (await env.DB.prepare("SELECT COUNT(*) AS c FROM job_statuses WHERE org_id = ?")
    .bind(orgId)
    .first()) as { c: number };
  if (row.c > 0) return;
  const now = Date.now();
  for (const s of DEFAULT_STATUSES) {
    await env.DB.prepare(
      "INSERT INTO job_statuses (id, org_id, name, color, done, sort_order, created_at) VALUES (?,?,?,?,?,?,?)",
    )
      .bind(crypto.randomUUID(), orgId, s.name, s.color, s.done ? 1 : 0, s.sortOrder, now)
      .run();
  }
}

export async function listStatuses(
  env: Env,
  orgId: string,
): Promise<{ name: string; color: string; done: boolean }[]> {
  const rows = (await env.DB.prepare(
    "SELECT name, color, done FROM job_statuses WHERE org_id = ? ORDER BY sort_order, created_at",
  )
    .bind(orgId)
    .all()) as any;
  return rows.results?.map((r: any) => ({ name: r.name, color: r.color, done: !!r.done })) ?? [];
}
