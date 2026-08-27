import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import type { Customer } from "../types";
import { joinAddress } from "../types";
import { Button } from "../components/ui/button";
import CustomerModal from "../components/CustomerModal";
import SearchBox from "../components/SearchBox";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (query = q) => {
      api<{ customers: Customer[] }>(
        `/api/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`,
      )
        .then((r) => setCustomers(r.customers))
        .catch((e) => setError(e.message));
    },
    [q],
  );

  useEffect(() => {
    load();
  }, [load]);

  const save = async (data: Omit<Customer, "id">, id?: string) => {
    if (id) {
      await api(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      toast.success(`「${data.name}」を更新しました`);
    } else {
      await api("/api/customers", { method: "POST", body: JSON.stringify(data) });
      toast.success(`「${data.name}」を追加しました`);
    }
    setCreating(false);
    setEditing(null);
    load();
  };

  const remove = async (c: Customer) => {
    if (!confirm(`「${c.name}」を削除しますか? (作業伝票との紐付けも外れます)`)) return;
    await api(`/api/customers/${c.id}`, { method: "DELETE" });
    toast.success(`「${c.name}」を削除しました`);
    load();
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h2>顧客管理</h2>
          <div className="sub">
            連絡先は複数登録可能。作業作成時に「どの住所・電話」を使うか選べます。
          </div>
        </div>
        <Button onClick={() => setCreating(true)}>+ 顧客を追加</Button>
      </div>

      <SearchBox
        className="mb-4 max-w-96"
        placeholder="名前・電話・住所で検索…"
        value={q}
        onChange={setQ}
      />

      {error && <p className="error">{error}</p>}

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>電話</th>
              <th>メール</th>
              <th>住所</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <b>{c.name}</b>
                  {c.notes && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      {c.notes}
                    </div>
                  )}
                </td>
                <td style={{ maxWidth: 200 }}>
                  {c.phones.map((p, i) => (
                    <div key={i} className="num" style={{ fontSize: 13 }}>
                      {p}
                    </div>
                  ))}
                </td>
                <td style={{ maxWidth: 200 }}>
                  {c.emails.map((e, i) => (
                    <div key={i} className="num" style={{ fontSize: 13 }}>
                      {e}
                    </div>
                  ))}
                </td>
                <td style={{ maxWidth: 220 }}>
                  {c.addresses.map((a, i) => (
                    <div key={i} style={{ fontSize: 13 }}>
                      {a.postal && (
                        <span className="num muted" style={{ fontSize: 12 }}>
                          〒{a.postal}{" "}
                        </span>
                      )}
                      {joinAddress(a)}
                    </div>
                  ))}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                      編集
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(c)}>
                      削除
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: 18 }}>
                  {q ? "検索結果がありません" : "まだ顧客が登録されていません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <CustomerModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(data) => save(data, editing?.id)}
        />
      )}
    </div>
  );
}
