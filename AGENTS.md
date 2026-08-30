# AGENTS.md

清掃事業者向け SaaS「banrai」の開発ガイド。エージェントはこのファイルを必ず読むこと。

## 技術スタック

- **Worker**: Cloudflare Workers (workerd) + Hono。エントリ `src/index.ts`
- **認証**: better-auth v1.7 (email/password + admin + organization + Dynamic Access Control)
- **DB**: Cloudflare D1 (SQLite)。マイグレーションは `migrations/*.sql`
- **UI**: Vite + React 19 + Tailwind v4 + shadcn/ui (手動展開済み) + lucide。`web/` 配下
- **メール**: Cloudflare Email Service (`send_email` バインディング)
- **テスト**: vitest + `@cloudflare/vitest-plugin` (実 workerd 上で実行)
- **Storybook**: SB10 (react-vite)。`.storybook/main.ts` が viteFinal で alias/tailwind を注入

## 頻出コマンド

- `npm run dev` — worker (:8787) + web (:5173) 並列起動。`.dev.vars` が必要
- `npm run check` — **lint + fmt check + typecheck + test を一括実行**。変更後は必ず通す
- `npm run fmt` — oxfmt で整形 (check が落ちたら最初にこれ)
- `npm run test` — vitest (workerd 上の統合テスト含む、約10秒)
- `npm run build:web` / `npx storybook build` / `npm run storybook` (dev :6006)
- **デプロイ**: ① `npm run migrations:apply:remote` → ② `npm run deploy`
- `npx wrangler types` — wrangler.jsonc 変更後に実行 (worker-configuration.d.ts 再生成)

## アーキテクチャ地図

```
src/index.ts            エントリ: assets フォールバック + Hono (/api と MCP 系パスを先にルーティング)
src/server/auth.ts      better-auth インスタンス (plugins.ts が設定を組み立て)
src/server/plugins.ts   認証プラグイン構成 (admin/organization/email)
src/server/routes.ts    業務 API (Hono)。org スコープ + hasPermission で保護
src/server/statuses.ts  ジョブステータスのデフォルトシード/一覧
src/server/demo.ts      デモテナントの冪等シード (POST /api/demo/login)
src/server/email.ts     メール送信 (テンプレート含む)
src/server/mcp/         MCP サーバー (streamable HTTP + OAuth 2.0, RFC 9971)
  index.ts              /mcp ルート + bearer 検証 + well-known メタデータ
  oauth.ts              認可サーバー (/register /authorize /token)+ ログイン/同意ページ
  tools.ts              MCP ツール定義 (18個)。権限は perm.ts の can() で都度検証
  perm.ts               better-auth の hasPermission と同等のローカル解決 (member.role + organizationRole)
src/shared/permissions.ts  権限 statement/ロール定義 (サーバー・UI 共用)
migrations/*.sql        D1 マイグレーション (番号順、テストにも明示追加が必要)
web/src/pages/          画面 (Calendar/Jobs(Kanban)/Staff/Services/Customers/Roles)
web/src/components/     コンポーネント (ui/ は shadcn、他は業務部品)
web/src/date.ts         日付・時刻ユーティリティ (**JST 固定**)
```

## 守るべき規約 (バグの温床になるので厳守)

1. **日付は常に JST (Asia/Tokyo)**。`web/src/date.ts` のヘルパーを使うこと。`new Date()` の getDay/getMonth を直接使わない。
   - 保存仕様: `scheduled_date` = JST の `YYYY-MM-DD`、`start_minute` = JST 0時起点の分、`created_at/updated_at` = epoch ms
2. **カラム名**: 業務テーブル (services/jobs/customers/job_statuses/job_assignments) は snake_case、better-auth テーブル (user/session/organization/member…) は camelCase。SQL を書くとき混同しないこと。
3. **JSON カラム** (services.options, customers.phones/emails/addresses, organizationRole.permission) は API で必ず parse/stringify する。GET で生の文字列を返すな。
4. **権限**: 新リソースは `src/shared/permissions.ts` の statement + owner/admin は full、member は read のみ。API は `guard()` + `can()` を使用。
5. **API の追加**: routes.ts の zod schema → INSERT/UPDATE は explicit columns。`jobs` の INSERT は列を明示 (17列)。MCP ツールも同じ Zod スキーマを routes.ts から import して使うこと (二重定義禁止)。
6. **マイグレーション**: 新しい `migrations/NNNN_*.sql` を追加したら、`src/server/app.test.ts` の `beforeAll` の適用リストにも必ず足す。
7. **デモ**: `POST /api/demo/login` が冪等にデモテナント (demo@example.com 等) をシードする。デモ口座にはメールを送らない (email.ts で example.com を除外)。
8. **コメントを書かない** (コード本体)。README/ADR に書く。
9. 秘密 (BETTER_AUTH_SECRET 等) をコードに書かない。.dev.vars / Cloudflare secrets / CI secrets で管理。
10. **UI 変更後は必ず**: `npm run check` + `npm run build:web` (必要なら storybook build)。
11. **MCP サーバー**: `https://banrai.nngn.dev/mcp` (streamable HTTP + OAuth 2.0 / RFC 9971)。クライアントは動的登録 → ブラウザでログイン/同意 → token。**ツールの権限チェックは親 API と同じ statement を perm.ts の `can()` で都度検証** — MCP 独自の抜け道を作らない。トークンはユーザー+組織にバインドされ、refresh は回転する (mcp_tokens テーブル)。認可サーバー変更時は OAuth 仕様 (RFC 6749/7591/8414/9728/8707 + PKCE) を必ず参照すること。

## デプロイフロー (本番: banrai.nngn.dev)

1. `npm run check`
2. migration があれば `npm run migrations:apply:remote`
3. `npm run deploy`
4. デモデータをリセットしたい場合のみ: d1 execute で demo-clean 組織を削除 → 次回ログインで再シード

## テストの仕組み

- `src/server/app.test.ts`: 実 workerd + 実 D1 (isolated storage)。migrations/*.sql を `?raw` import して適用
- 認証済みセッションは cookie 文字列を手動で引き回す (cookieFrom helper)
- テスト用 BETTER_AUTH_URL は `https://example.com` (miniflare bindings で注入)
- `testTimeout: 15000` (workerd 起動が遅いため)
