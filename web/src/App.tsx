import { useState } from "react";
import { CalendarDays, ListTodo, Users, Sparkles, ShieldCheck } from "lucide-react";
import { authClient, useSession } from "./lib/auth-client";
import { Toaster } from "./components/ui/sonner";
import { Button } from "./components/ui/button";
import CalendarPage from "./pages/CalendarPage";
import JobsPage from "./pages/JobsPage";
import StaffPage from "./pages/StaffPage";
import ServicesPage from "./pages/ServicesPage";
import RolesPage from "./pages/RolesPage";

type Tab = "cal" | "jobs" | "staff" | "services" | "roles";

const NAV: { key: Tab; icon: typeof CalendarDays; label: string }[] = [
  { key: "cal", icon: CalendarDays, label: "週間カレンダー" },
  { key: "jobs", icon: ListTodo, label: "作業一覧" },
  { key: "staff", icon: Users, label: "スタッフ" },
  { key: "services", icon: Sparkles, label: "サービス" },
  { key: "roles", icon: ShieldCheck, label: "ロール" },
];

function Labelled(props: { label: string; children: React.ReactNode }) {
  return (
    <label>
      {props.label}
      {props.children}
    </label>
  );
}

export default function App() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;
  if (!session) return <AuthScreen />;
  const orgId = (session.session as { activeOrganizationId?: string | null }).activeOrganizationId;
  if (!orgId) return <OrgSelect />;
  return (
    <>
      <Shell userEmail={session.user.email} />
      <Toaster />
    </>
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
      const r =
        mode === "signup"
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });
      if (r.error) throw new Error(r.error.message || r.error.statusText);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--paper)",
      }}
    >
      <div className="card" style={{ width: 360, padding: 26 }}>
        <div className="brand" style={{ padding: "0 0 14px" }}>
          banrai <small>清掃事業者向け 作業管理</small>
        </div>
        <div style={{ marginBottom: 14, display: "flex", gap: 6 }}>
          <Button
            type="button"
            variant={mode === "signin" ? "default" : "outline"}
            onClick={() => setMode("signin")}
          >
            ログイン
          </Button>
          <Button
            type="button"
            variant={mode === "signup" ? "default" : "outline"}
            onClick={() => setMode("signup")}
          >
            新規登録
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Labelled label="メールアドレス">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%" }}
            />
          </Labelled>
          {mode === "signup" && (
            <Labelled label="名前">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </Labelled>
          )}
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
          {error && <p className="error">{error}</p>}
          <Button disabled={busy} style={{ width: "100%" }}>
            {busy ? "…" : mode === "signin" ? "ログイン" : "登録する"}
          </Button>
        </form>
      </div>
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
    <div style={{ maxWidth: 460, margin: "60px auto", padding: "0 16px" }}>
      {pending && (
        <div className="card">
          <Button onClick={accept} disabled={busy}>
            招待を承諾する
          </Button>
          {error && <p className="error">{error}</p>}
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
              padding: "10px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{org.name}</div>
              <div className="muted num">{org.slug}</div>
            </div>
            <Button
              variant="outline"
              onClick={() => authClient.organization.setActive({ organizationId: org.id })}
            >
              選択
            </Button>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={create} style={{ display: "grid", gap: 12 }}>
        <h3 style={{ margin: 0 }}>事業者を新規作成</h3>
        <Labelled label="会社名">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </Labelled>
        <Labelled label="slug (識別子)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            style={{ width: "100%" }}
          />
        </Labelled>
        {error && <p className="error">{error}</p>}
        <Button type="submit" disabled={busy}>
          作成
        </Button>
      </form>
    </div>
  );
}

function Shell({ userEmail }: { userEmail: string }) {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const [tab, setTab] = useState<Tab>("cal");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          banrai <small>作業管理</small>
        </div>
        {NAV.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.key}
              className={`nav-item ${tab === n.key ? "active" : ""}`}
              onClick={() => setTab(n.key)}
            >
              <Icon className="size-4" />
              {n.label}
            </button>
          );
        })}
        <div className="spacer" />
        <div className="org-chip">
          事業者
          <b>{activeOrg?.name}</b>
        </div>
        <div className="user-chip">
          <span className="avatar">{userEmail.slice(0, 1).toUpperCase()}</span>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{userEmail}</span>
          <Button size="sm" variant="ghost" onClick={() => authClient.signOut()}>
            退出
          </Button>
        </div>
      </aside>
      <main className="main">
        {tab === "cal" && <CalendarPage />}
        {tab === "jobs" && <JobsPage />}
        {tab === "staff" && <StaffPage />}
        {tab === "services" && <ServicesPage />}
        {tab === "roles" && <RolesPage />}
      </main>
    </div>
  );
}
