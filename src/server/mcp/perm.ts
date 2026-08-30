import { roles, statement } from "../../shared/permissions";

type Statements = Record<string, readonly string[]>;

const roleStatements = new Map<string, Statements>();
for (const [name, role] of Object.entries(roles)) {
  roleStatements.set(name, role.statements as unknown as Statements);
}

export type PermissionResource = keyof typeof statement;

export async function can(
  env: Env,
  userId: string,
  orgId: string,
  resource: PermissionResource,
  action: string,
): Promise<boolean> {
  const member = (await env.DB.prepare(
    "SELECT role FROM member WHERE organizationId = ? AND userId = ?",
  )
    .bind(orgId, userId)
    .first()) as { role: string } | null;
  if (!member) return false;

  const orgRoleRows = (await env.DB.prepare(
    "SELECT role, permission FROM organizationRole WHERE organizationId = ?",
  )
    .bind(orgId)
    .all()) as { results: { role: string; permission: string }[] };

  const acRoles = new Map<string, Statements>(roleStatements);
  for (const row of orgRoleRows.results) {
    const custom = JSON.parse(row.permission) as Record<string, string[]>;
    const merged: Statements = { ...acRoles.get(row.role) };
    for (const [key, actions] of Object.entries(custom)) {
      merged[key] = [...new Set([...(merged[key] ?? []), ...actions])];
    }
    acRoles.set(row.role, merged);
  }

  for (const role of member.role.split(",")) {
    if ((acRoles.get(role)?.[resource] ?? []).includes(action)) return true;
  }
  return false;
}
