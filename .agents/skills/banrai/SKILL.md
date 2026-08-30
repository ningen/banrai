---
name: banrai
description: banrai (清掃事業者向け作業管理 SaaS) の開発ガイド。編集前に毎回ロードすること。
---

# banrai — Cloudflare Workers + D1 多テナント作業管理

清掃事業者向け SaaS。事業者 (organization) ごとにスタッフ・作業・カレンダーを持つ。
本番: https://banrai.nngn.dev

## 重要ルール (短縮版、詳細は AGENTS.md)

- **日付は JST 固定**: `web/src/date.ts` のヘルパーを使う。ローカル TZ の getDay/getMonth 禁止
- **DB**: 業務テーブルは snake_case、better-auth テーブルは camelCase。JSON カラムは API で必ず対応
- **権限**: 新リソースは `src/shared/permissions.ts` + `guard()`/`can()` (org スコープ)
- **実装後は必ず `npm run check`** (lint/fmt/typecheck/test)

## 作業フロー

1. 要件を読んでからコードを探索する (早まって書かない)
2. migration が要る場合は `migrations/NNNN_*.sql` を作成し、**テストの適用リストにも追加**する
3. 実装 → `npm run check` → `npm run build:web`
4. ローカル確認: `npm run dev` (worker :8787 / web :5173、`.dev.vars` が必要)
5. デプロイ: `npm run migrations:apply:remote` → `npm run deploy` (GitHub Actions が main で自動実行もする)

## 主要テーブル

- `organizations` (better-auth) — 事業者。業務テーブルの org_id フィルタは必須
- `services` — 作業メニュー (color/duration_min/price/options JSON)
- `customers` — 複数連絡先 (phones/emails/addresses は JSON 配列、addresses は郵便番号構造化)
- `jobs` — 作業 (status=ステータス名, position=列内順序, 住所は4カラム構造化)
- `job_statuses` — 任意ステータス (color/done)
- `job_assignments` — スタッフ割当

## よくある注意

- デモは `POST /api/demo/login` が冪等シード (email example.com 宛は送信しない)
- カンバンは @dnd-kit sortable。ドロップ位置挿入は position で永続化
- secrets はコードに入れない (`.dev.vars` / wrangler secret)
- コードコメント禁止 → 判断は docs/adr に書く
- MCP: `https://banrai.nngn.dev/mcp` (OAuth 2.0 / RFC 9971, `src/server/mcp/`)。ツールの権限は `perm.ts` の `can()` を都度検証 (親 API と同じ statement)。トークンはユーザー+組織バインド、refresh は回転
