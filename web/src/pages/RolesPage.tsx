import { useState } from "react";
import { authClient } from "../lib/auth-client";

const PERMS: Record<string, string[]> = {
  job: ["create", "read", "update", "delete", "assign"],
  service: ["create", "read", "update", "delete"],
  assignment: ["create", "read", "update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  organization: ["update", "delete"],
};

export default function RolesPage() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    const permission: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(PERMS)) {
      const chosen = actions.filter((a) => perms.includes(`${resource}:${a}`));
      if (chosen.length) permission[resource] = chosen;
    }
    if (Object.keys(permission).length === 0) {
      setError("1つ以上の権限を選んでください");
      return;
    }
    const r = await authClient.organization.createRole({
      role: name,
      permission,
      organizationId: activeOrg?.id,
    });
    if (r.error) setError(String((r.error as any)?.message || "create failed"));
    else {
      setCreated(`ロール「${name}」を作成しました`);
      setName("");
      setPerms([]);
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>ロール</h2>
          <div className="sub">事業者内のカスタムロールを作成し、スタッフに割り当てられます。</div>
        </div>
      </div>

      <form className="card" onSubmit={create} style={{ maxWidth: 520 }}>
        <div style={{ marginBottom: 12 }}>
          <label>ロール名 (ex: リーダー)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </div>
        {Object.entries(PERMS).map(([resource, actions]) => (
          <div key={resource} style={{ marginBottom: 6 }}>
            <b style={{ fontSize: 13 }}>{resource}</b>{" "}
            {actions.map((a) => (
              <label
                key={a}
                style={{
                  display: "inline-flex",
                  gap: 4,
                  margin: "0 10px 0 0",
                  fontSize: 13,
                  fontWeight: 400,
                }}
              >
                <input
                  type="checkbox"
                  checked={perms.includes(`${resource}:${a}`)}
                  onChange={(e) =>
                    setPerms((p) =>
                      e.target.checked
                        ? [...p, `${resource}:${a}`]
                        : p.filter((x) => x !== `${resource}:${a}`),
                    )
                  }
                />
                {a}
              </label>
            ))}
          </div>
        ))}
        {error && <p className="error">{error}</p>}
        {created && <p style={{ color: "var(--done)", fontSize: 13 }}>{created}</p>}
        <button className="primary">ロールを作成</button>
      </form>
    </div>
  );
}
