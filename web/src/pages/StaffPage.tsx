import { useCallback, useEffect, useState } from "react";
import { authClient } from "../lib/auth-client";
import type { Member } from "../types";

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await authClient.organization.listMembers();
    if (r.error) setError(String((r.error as any)?.message));
    else setMembers((r.data as { members: Member[] } | undefined)?.members ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = await authClient.organization.inviteMember({ email: inviteEmail, role });
    if (r.error) setError(String((r.error as any)?.message || "invite failed"));
    else setInviteEmail("");
  };

  const changeRole = async (memberId: string, newRole: string) => {
    setError(null);
    const r = await authClient.organization.updateMemberRole({ memberId, role: newRole });
    if (r.error) setError(String((r.error as any)?.message));
    await load();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>スタッフ</h2>
          <div className="sub">招待 → 承諾 → ロール付与の手順で追加できます。</div>
        </div>
      </div>

      <form className="card grid-form" onSubmit={invite}>
        <div>
          <label>スタッフのメールアドレス</label>
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>ロール</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button className="primary">招待を送る</button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th></th>
              <th>名前</th>
              <th>メール</th>
              <th>ロール</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>
                  <span
                    className="avatar"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--paper)",
                      border: "1px solid var(--line-strong)",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {m.user?.name.slice(0, 1) ?? "?"}
                  </span>
                </td>
                <td>{m.user?.name}</td>
                <td className="num">{m.user?.email}</td>
                <td>
                  <input
                    value={m.role}
                    style={{ width: 120 }}
                    onChange={(e) => changeRole(m.id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
