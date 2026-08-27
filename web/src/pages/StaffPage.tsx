import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";
import { api } from "../api";
import type { Member } from "../types";
import { Avatar } from "../components/bits";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const STATIC_ROLES = ["owner", "admin", "member"] as const;

export default function StaffPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, rolesRes] = await Promise.all([
      authClient.organization.listMembers(),
      api<{ roles: { role: string }[] }>("/api/org-roles").catch(() => ({ roles: [] })),
    ]);
    if (r.error) setError(String((r.error as any)?.message));
    else setMembers((r.data as { members: Member[] } | undefined)?.members ?? []);
    setCustomRoles(rolesRes.roles.map((x) => x.role));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const r = await authClient.organization.inviteMember({ email: inviteEmail, role });
    if (r.error) setError(String((r.error as any)?.message || "invite failed"));
    else {
      toast.success(`「${inviteEmail}」に招待メールを送信しました`);
      setInviteEmail("");
    }
  };

  const changeRole = async (memberId: string, newRole: string) => {
    setError(null);
    const r = await authClient.organization.updateMemberRole({ memberId, role: newRole });
    if (r.error) toast.error(String((r.error as any)?.message));
    else toast.success("ロールを更新しました");
    await load();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>スタッフ</h2>
          <div className="sub">
            招待 → 承諾 → ロール付与。カスタムロールは「ロール」タブで作成できます。
          </div>
        </div>
      </div>

      <form className="card grid-form" onSubmit={invite}>
        <div>
          <Label>スタッフのメールアドレス</Label>
          <Input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>初期ロール</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">member</SelectItem>
              <SelectItem value="admin">admin</SelectItem>
              {customRoles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit">招待を送る</Button>
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
                  <Avatar name={m.user?.name ?? "?"} size={26} />
                </td>
                <td>{m.user?.name}</td>
                <td className="num">{m.user?.email}</td>
                <td>
                  <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...STATIC_ROLES, ...customRoles].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
