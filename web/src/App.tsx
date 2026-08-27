import { useCallback, useEffect, useMemo, useState } from "react";
import { authClient, useSession } from "./lib/auth-client";
import { api } from "./api";

type Service = { id: string; name: string; description: string; duration_min: number };
type Job = {
  id: string;
  service_id: string | null;
  service_name: string | null;
  customer_name: string;
  address: string;
  scheduled_date: string;
  start_minute: number | null;
  duration_min: number;
  status: string;
  notes: string;
  assignments: { member_id: string }[];
};
type Member = { id: string; user: { id: string; name: string; email: string }; role: string };

function fmtMin(min: number | null) {
  if (min == null) return "–";
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending)
    return (
      <div className="card" style={{ margin: 24 }}>
        loading…
      </div>
    );
  if (!session) return <AuthScreen />;
  return <Dashboard />;
}

function Labelled(props: { label: string; children: React.ReactNode }) {
  return (
    <label>
      {props.label}
      {props.children}
    </label>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const r = await authClient.signUp.email({ email, password, name });
        if (r.error) throw new Error(r.error.message || r.error.statusText);
      } else {
        const r = await authClient.signIn.email({ email, password });
        if (r.error) throw new Error(r.error.message || r.error.statusText);
      }
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>banrai</h1>
      <p className="muted">清掃事業者向け 作業管理プラットフォーム</p>
      <form className="card" onSubmit={submit}>
        <div style={{ marginBottom: 10 }}>
          <button
            type="button"
            className={mode === "signin" ? "primary" : ""}
            onClick={() => setMode("signin")}
            style={{ marginRight: 6 }}
          >
            ログイン
          </button>
          <button
            type="button"
            className={mode === "signup" ? "primary" : ""}
            onClick={() => setMode("signup")}
          >
            新規登録
          </button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <Labelled label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </Labelled>
        </div>
        {mode === "signup" && (
          <div style={{ marginBottom: 10 }}>
            <Labelled label="名前">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </Labelled>
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <Labelled label="パスワード (8文字以上)">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{ width: "100%" }}
            />
          </Labelled>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy} style={{ width: "100%" }}>
          {busy ? "…" : mode === "signin" ? "ログイン" : "登録する"}
        </button>
      </form>
    </div>
  );
}

function Dashboard() {
  const { data: session, refetch: refetchSession } = useSession();
  const orgId = (session?.session as any)?.activeOrganizationId;
  const [tab, setTab] = useState<"main" | "services" | "staff" | "jobs" | "roles">("main");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ margin: 0 }}>banrai</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="muted">{session?.user.email}</span>
          <button onClick={() => authClient.signOut()}>サインアウト</button>
        </div>
      </header>
      {!orgId ? (
        <OrgSelect />
      ) : (
        <>
          <nav style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {(
              [
                ["main", "ホーム"],
                ["services", "サービス"],
                ["staff", "スタッフ"],
                ["jobs", "作業"],
                ["roles", "ロール"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "primary" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "main" && <Overview onRefetch={refetchSession} />}
          {tab === "services" && <Services />}
          {tab === "staff" && <Staff />}
          {tab === "jobs" && <Jobs />}
          {tab === "roles" && <Roles />}
        </>
      )}
    </div>
  );
}

function OrgSelect() {
  const { data: orgs } = authClient.useListOrganizations();
  const pending = new URLSearchParams(location.search).get("id");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authClient.organization.acceptInvitation({ invitationId: pending });
      if (r.error) throw new Error((r.error as any)?.message || "accept failed");
      const invitation = r.data.invitation as any;
      await authClient.organization.setActive({ organizationId: invitation.organizationId });
      history.replaceState(null, "", "/");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await authClient.organization.create({ name, slug });
      if (r.error) throw new Error((r.error as any)?.message || "create failed");
      await authClient.organization.setActive({ organizationId: r.data.id });
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 480, margin: "40px auto" }}>
      {pending && (
        <div className="card">
          <button className="primary" onClick={accept} disabled={busy}>
            招待を承諾する
          </button>
        </div>
      )}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>事業者を選択</h3>
        {orgs && orgs.length === 0 && (
          <p className="muted">事業者がありません。下のフォームから作成してください。</p>
        )}
        {orgs?.map((org) => (
          <div
            key={org.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div>
              <div>{org.name}</div>
              <div className="muted">{org.slug}</div>
            </div>
            <button onClick={() => authClient.organization.setActive({ organizationId: org.id })}>
              選択
            </button>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={create}>
        <h3 style={{ marginTop: 0 }}>事業者を新規作成</h3>
        <div style={{ marginBottom: 10 }}>
          <Labelled label="会社名">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </Labelled>
        </div>
        <div style={{ marginBottom: 10 }}>
          <Labelled label="slug (URL/識別子)">
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              pattern="[a-z0-9-]+"
              style={{ width: "100%" }}
            />
          </Labelled>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          作成
        </button>
      </form>
    </div>
  );
}

function Overview({ onRefetch }: { onRefetch: () => void }) {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [member, setMember] = useState<{ role: string } | null>(null);
  useEffect(() => {
    authClient.organization.getActiveMember().then((r) => {
      if (!r.error) setMember(r.data as any);
    });
  }, []);
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{activeOrg?.name}</h3>
      <p>
        あなたのロール: <strong>{member?.role}</strong>
      </p>
      <p className="muted">
        事業者ごとにスタッフ (role) を招待し、作業を割り当てて曜日・月別のカレンダーで確認できます。
      </p>
      <button className="primary" onClick={onRefetch}>
        セッションを再取得
      </button>
    </div>
  );
}

function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api<{ services: Service[] }>("/api/services")
        .then((r) => setServices(r.services))
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/services", {
        method: "POST",
        body: JSON.stringify({ name, durationMin: Number(duration) }),
      });
      setName("");
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const remove = async (id: string) => {
    await api(`/api/services/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <form
        className="card"
        onSubmit={create}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div>
          <Labelled label="提供する作業名 (ex: エアコンクリーニング)">
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </Labelled>
        </div>
        <div>
          <Labelled label="標準所要時間 (分)">
            <input
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </Labelled>
        </div>
        <button className="primary">追加</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>名前</th>
            <th>所要時間</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>{s.duration_min}分</td>
              <td>
                <button className="danger" onClick={() => remove(s.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Staff() {
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await authClient.organization.listMembers();
    if (r.error) setError(String((r.error as any)?.message));
    else setMembers((r.data as any)?.members ?? []);
  }, []);
  useEffect(() => {
    load();
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
      <form
        className="card"
        onSubmit={invite}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div>
          <Labelled label="スタッフのメールアドレス">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
          </Labelled>
        </div>
        <div>
          <Labelled label="ロール">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
          </Labelled>
        </div>
        <button className="primary">招待を送る</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>名前</th>
            <th>メール</th>
            <th>ロール</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.id}>
              <td>{m.user?.name}</td>
              <td>{m.user?.email}</td>
              <td>{m.role}</td>
              <td>
                <input value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Jobs() {
  const [services, setServices] = useState<Service[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerName, setCustomerName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const weekStart = new Date(
      new Date(date + "T00:00:00").getTime() - new Date(date + "T00:00:00").getDay() * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const weekEnd = new Date(new Date(weekStart + "T00:00:00").getTime() + 6 * 86400000)
      .toISOString()
      .slice(0, 10);
    try {
      const [svc, mem] = await Promise.all([
        api<{ services: Service[] }>("/api/services"),
        authClient.organization.listMembers(),
      ]);
      setServices(svc.services);
      setMembers((mem.data as any)?.members ?? ([] as Member[]));
      const jobsRes = await fetch(`/api/jobs?from=${weekStart}&to=${weekEnd}`);
      const body = await jobsRes.json();
      setJobs(body.jobs ?? []);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify({ serviceId: serviceId || null, customerName, scheduledDate: date }),
      });
      setCustomerName("");
      await load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const assign = async (jobId: string, memberId: string) => {
    if (!memberId) return;
    await api(`/api/jobs/${jobId}/assign`, { method: "POST", body: JSON.stringify({ memberId }) });
    await load();
  };

  const byDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const j of jobs) {
      const list = map.get(j.scheduled_date) ?? [];
      list.push(j);
      map.set(j.scheduled_date, list);
    }
    return map;
  }, [jobs]);

  return (
    <div>
      <form
        className="card"
        onSubmit={create}
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}
      >
        <div>
          <Labelled label="顧客名">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
            />
          </Labelled>
        </div>
        <div>
          <Labelled label="作業日">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Labelled>
        </div>
        <div>
          <Labelled label="提供サービス">
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">(なし)</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Labelled>
        </div>
        <button className="primary">作業を追加</button>
      </form>
      {error && <p className="error">{error}</p>}
      {[...byDate.entries()].toSorted().map(([d, list]) => (
        <div key={d} className="card">
          <h4 style={{ marginTop: 0 }}>{d}</h4>
          {list.map((j) => (
            <div
              key={j.id}
              style={{
                borderBottom: "1px solid var(--line)",
                padding: "6px 0",
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>{fmtMin(j.start_minute)}</span>
              <strong>{j.customer_name}</strong>
              <span className="muted">{j.service_name ?? "（サービス未設定）"}</span>
              <span className="muted">
                ({j.duration_min}分) {j.status}
              </span>
              {j.assignments?.length === 0 && <span className="muted">未割当</span>}
              {j.assignments?.map((a) => (
                <span key={a.member_id} className="muted">
                  → {members.find((m) => m.user?.id === a.member_id)?.user?.name ?? "?"}{" "}
                </span>
              ))}
              <span style={{ marginLeft: "auto" }}>
                <select defaultValue="" onChange={(e) => assign(j.id, e.target.value)}>
                  <option value="">staff に割当…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.user?.id}>
                      {m.user?.name}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Roles() {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const PERMS: Record<string, string[]> = {
    service: ["create", "read", "update", "delete"],
    job: ["create", "read", "update", "delete", "assign"],
    assignment: ["create", "read", "update", "delete"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    organization: ["update", "delete"],
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const permission: Record<string, string[]> = {};
    for (const [resource, actions] of Object.entries(PERMS)) {
      const chosen = actions.filter((a) => perms.includes(`${resource}:${a}`));
      if (chosen.length) permission[resource] = chosen;
    }
    const r = await authClient.organization.createRole({
      role: name,
      permission,
      organizationId: activeOrg?.id,
    });
    if (r.error) setError(String((r.error as any)?.message || "create failed"));
    else setName("");
  };

  return (
    <div className="card">
      <p className="muted">
        事業者内でカスタムロールを作成して staff に割り当てられます (Dynamic Access Control)。
      </p>
      <form onSubmit={create}>
        <div style={{ marginBottom: 10 }}>
          <Labelled label="ロール名">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="ex: リーダー"
            />
          </Labelled>
        </div>
        {Object.entries(PERMS).map(([resource, actions]) => (
          <div key={resource} style={{ marginBottom: 6 }}>
            <strong style={{ fontSize: 13 }}>{resource}</strong>{" "}
            {actions.map((a) => (
              <label
                key={a}
                style={{ display: "inline-flex", gap: 4, margin: "0 10px 0 0", fontSize: 13 }}
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
        <button className="primary">ロールを作成</button>
      </form>
    </div>
  );
}
