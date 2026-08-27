import type { Meta, StoryObj } from "@storybook/react-vite";

const PALETTE: { name: string; value: string }[] = [
  { name: "paper", value: "#f7f7f5" },
  { name: "surface", value: "#ffffff" },
  { name: "line", value: "#e7e6e1" },
  { name: "ink", value: "#1b1b19" },
  { name: "ink-soft", value: "#45443f" },
  { name: "muted", value: "#6f6d66" },
  { name: "indigo", value: "#2753e4" },
  { name: "indigo-20", value: "#dfe7fb" },
  { name: "indigo-10", value: "#eef2fd" },
  { name: "svc-aircon", value: "#29a3e8" },
  { name: "svc-house", value: "#e8a33d" },
  { name: "svc-hood", value: "#8a6be0" },
  { name: "done", value: "#0e9f6e" },
  { name: "destructive", value: "#c93f3f" },
];

function Tokens() {
  return (
    <div
      style={{
        fontFamily: "var(--font-sans)",
        color: "var(--ink)",
        backgroundColor: "var(--paper)",
        padding: 24,
        borderRadius: 12,
      }}
    >
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Paper &amp; Ink Indigo — Tokens</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 10,
          margin: "20px 0 32px",
        }}
      >
        {PALETTE.map((c) => (
          <div
            key={c.name}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 8,
              overflow: "hidden",
              background: "var(--surface)",
            }}
          >
            <div
              style={{ height: 44, background: c.value, borderBottom: "1px solid var(--line)" }}
            />
            <div style={{ padding: "6px 8px", fontSize: 12 }}>
              <b>{c.name}</b>
              <div className="num" style={{ color: "var(--muted)" }}>
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>
        週間カレンダー — IBM Plex Sans / JP
      </p>
      <p style={{ fontSize: 15 }}>スタッフ5名で回すエアコン・ハウスクリーニングの現場管理</p>
      <p style={{ fontSize: 13, color: "var(--muted)" }}>
        8月27日(木) 10:00–11:30 ・ エアコン×2 ・ 丸山ビル502
      </p>
      <p className="num" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>
        10:00 11:30 13:00 14:15
      </p>
      <p style={{ fontSize: 11, color: "var(--faint)" }}>
        tablular-nums を適用中 — 時刻の桁が揃います
      </p>
    </div>
  );
}

const meta = {
  title: "Design/Tokens",
  component: Tokens,
  tags: ["autodocs"],
} satisfies Meta<typeof Tokens>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
