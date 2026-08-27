import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../api";
import type { Customer } from "../types";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";

const EMPTY = { name: "", phone: "", email: "", address: "", notes: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ customers: Customer[] }>("/api/customers")
      .then((r) => setCustomers(r.customers))
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/customers", { method: "POST", body: JSON.stringify(form) });
      toast.success(`「${form.name}」を追加しました`);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(String((err as Error).message));
    }
  };

  const patch = async (id: string, data: Record<string, unknown>, silent = false) => {
    try {
      await api(`/api/customers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      load();
    } catch (err) {
      if (!silent) setError(String((err as Error).message));
    }
  };

  const remove = async (c: Customer) => {
    if (!confirm(`「${c.name}」を削除しますか? (作業伝票からは外れます)`)) return;
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
            お客さまの連絡先・住所を管理。作業作成時に候補から選択できます。
          </div>
        </div>
      </div>

      <form className="card" onSubmit={create} style={{ display: "grid", gap: 10 }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>名前 *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>電話</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>メール</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>住所</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>メモ</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <div>
          <Button type="submit">顧客を追加</Button>
        </div>
      </form>

      <div className="card" style={{ padding: 6 }}>
        <table>
          <thead>
            <tr>
              <th>名前</th>
              <th>電話</th>
              <th>メール</th>
              <th>住所</th>
              <th>メモ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <Input
                    defaultValue={c.name}
                    className="py-0 px-1 border-transparent hover:border-input"
                    onBlur={(e) =>
                      e.target.value !== c.name && patch(c.id, { name: e.target.value }, true)
                    }
                  />
                </td>
                <td>
                  <Input
                    defaultValue={c.phone}
                    className="num py-0 px-1 border-transparent hover:border-input"
                    onBlur={(e) =>
                      e.target.value !== c.phone && patch(c.id, { phone: e.target.value }, true)
                    }
                  />
                </td>
                <td>
                  <Input
                    defaultValue={c.email}
                    className="num py-0 px-1 border-transparent hover:border-input"
                    onBlur={(e) =>
                      e.target.value !== c.email && patch(c.id, { email: e.target.value }, true)
                    }
                  />
                </td>
                <td style={{ maxWidth: 220 }}>
                  <Input
                    defaultValue={c.address}
                    className="py-0 px-1 border-transparent hover:border-input"
                    onBlur={(e) =>
                      e.target.value !== c.address && patch(c.id, { address: e.target.value }, true)
                    }
                  />
                </td>
                <td style={{ maxWidth: 160 }}>
                  <Input
                    defaultValue={c.notes}
                    className="py-0 px-1 border-transparent hover:border-input"
                    onBlur={(e) =>
                      e.target.value !== c.notes && patch(c.id, { notes: e.target.value }, true)
                    }
                  />
                </td>
                <td>
                  <Button size="sm" variant="outline" onClick={() => remove(c)}>
                    削除
                  </Button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 18 }}>
                  まだ顧客が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
