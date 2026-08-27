import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
  ...defaultStatements,
  service: ["create", "read", "update", "delete"],
  job: ["create", "read", "update", "delete", "assign"],
  assignment: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

const full = () => ({
  organization: ownerAc.statements.organization,
  member: ownerAc.statements.member,
  invitation: ownerAc.statements.invitation,
  team: ownerAc.statements.team,
  ac: ownerAc.statements.ac,
  service: ["create", "read", "update", "delete"] as const,
  job: ["create", "read", "update", "delete", "assign"] as const,
  assignment: ["create", "read", "update", "delete"] as const,
});

export const owner = ac.newRole(full());

export const admin = ac.newRole({
  ...adminAc.statements,
  service: ["create", "read", "update", "delete"],
  job: ["create", "read", "update", "delete", "assign"],
  assignment: ["create", "read", "update", "delete"],
});

export const member = ac.newRole({
  ...memberAc.statements,
  service: ["read"],
  job: ["read"],
  assignment: ["read"],
});

export const roles = { owner, admin, member };
