import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api";
import { toISODate } from "../date";
import { Button } from "../components/ui/button";

type Connection = {
  client_id: string;
  client_name: string;
  scope: string;
  created_at: number;
  expires_at: number;
  token_count: number;
  orgs: string;
};

const MCP_URL = "https://banrai.nngn.dev/mcp";

export default function McpPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ connections: Connection[] }>("/api/mcp/connections");
      setConnections(res.connections);
    } catch (err) {
      setError(String((err as Error).message));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = async (conn: Connection) => {
    if (!window.confirm(`「${conn.client_name}」への接続を失効しますか？`)) return;
    try {
      await api(`/api/mcp/connections/${conn.client_id}`, { method: "DELETE" });
      toast.success(`「${conn.client_name}」への接続を失効しました`);
      await load();
    } catch (err) {
      toast.error(String((err as Error).message));
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>AI エージェント接続</h2>
          <div className="sub">
            MCP 経由で AI エージェントにこの組織のデータを操作させられます。失効するとその
            エージェントはすぐにアクセスできなくなります。
          </div>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        {connections.length === 0 ? (
          <div style={{ padding: "18px 12px" }}>
            <p className="muted" style={{ margin: 0 }}>
              接続された AI エージェントはありません。
            </p>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Claude Desktop や opencode などのエージェントで <code>{MCP_URL}</code>{" "}
              に接続すると、ここに一覧表示されます。
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>クライアント</th>
                <th>組織</th>
                <th>スコープ</th>
                <th>発行日 (JST)</th>
                <th>トークン期限 (JST)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {connections.map((conn) => (
                <tr key={conn.client_id}>
                  <td>{conn.client_name}</td>
                  <td className="num">{conn.orgs}</td>
                  <td className="num">{conn.scope}</td>
                  <td className="num">{toISODate(new Date(conn.created_at))}</td>
                  <td className="num">{toISODate(new Date(conn.expires_at))}</td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => void revoke(conn)}>
                      失効する
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
