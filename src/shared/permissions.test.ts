import { describe, expect, it } from "vitest";
import { ac, admin, member, owner } from "./permissions";

describe("role permissions", () => {
  it("owner has full access", () => {
    expect(owner.authorize({ job: ["create", "assign"], organization: ["delete"] }).success).toBe(
      true,
    );
    expect(owner.authorize({ ac: ["create"] }).success).toBe(true);
  });

  it("admin can manage business data and roles but cannot delete organization", () => {
    expect(admin.authorize({ service: ["create"], job: ["assign"] }).success).toBe(true);
    expect(admin.authorize({ organization: ["delete"] }).success).toBe(false);
    expect(admin.authorize({ ac: ["create"] }).success).toBe(true);
  });

  it("member can neither manage business data nor roles", () => {
    expect(member.authorize({ job: ["read"], service: ["read"] }).success).toBe(true);
    expect(member.authorize({ job: ["create"] }).success).toBe(false);
    expect(member.authorize({ assignment: ["create"] }).success).toBe(false);
    expect(member.authorize({ ac: ["create"] }).success).toBe(false);
  });

  it("cannot expand permissions beyond the statement", () => {
    // @ts-expect-error undefined action is typed never
    expect(owner.authorize({ job: ["explode"] }).success).toBe(false);
  });

  it("dynamic role created at runtime via newRole", () => {
    const lead = ac.newRole({ job: ["read", "assign"], service: ["read"] });
    expect(lead.authorize({ job: ["assign"] }).success).toBe(true);
    expect(lead.authorize({ job: ["create"] }).success).toBe(false);
    expect(lead.authorize({ service: ["update"] }).success).toBe(false);
  });
});
