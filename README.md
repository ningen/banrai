# banrai

清掃事業者(エアコンクリーニング・ハウスクリーニング等)向けの SaaS 作業管理プラットフォーム。

- **認証**: [better-auth](https://better-auth.com) v1.7 (email/password + admin plugin + organization plugin + Dynamic Access Control)
- **DB**: Cloudflare D1 (better-auth テーブル + 業務テーブル)
- **API**: Hono on Cloudflare Workers
- **UI**: Vite + React (SPA, Workers の静的アセットとして配信)
- **メール**: Cloudflare Email Service (`send_email` バインディング)

## 構成

```
src/
  index.ts            ... Worker エントリ (Hono + assets)
  server/auth.ts      ... better-auth インスタンス
  server/plugins.ts   ... 認証プラグイン構成 (admin/organization/email)
  server/permissions.ts  ... ロール & パーミッション定義 (ac 共有)
  server/email.ts     ... Email Service 送信 + メールテンプレート
  server/routes.ts    ... 業務 API (services/jobs/assignments/invitations)
  shared/permissions.ts ... サーバー/クライアント共有の ac・roles
web/                  ... React SPA (vite)
migrations/           ... D1 マイグレーション (auth スキーマは scripts/generate-auth-schema.mjs で生成)
scripts/              ... スキーマ生成・CLI 用 auth config
wrangler.jsonc
```

## 前提

- Node.js 24+ (npm)
- Cloudflare アカウント + `wrangler login`
- メール送信用に CSP(エンタープライズ/ビジネス)のドメイン in the same zone (Email Service)

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars    # BETTER_AUTH_SECRET は必ず変更
npm run migrations:apply:local    # ローカル D1 にスキーマ適用
npm run dev                       # worker: http://localhost:8787 / web: http://localhost:5173
```

`wrangler dev` 中のメールは `[mail:skip]` としてログされる (`EMAIL_FROM` 未設定時)。

## ツールチェーン

- **lint**: oxlint (`npm run lint`)
- **format**: oxfmt (`npm run fmt` / `npm run fmt:check`)
- **test**: vitest + `@cloudflare/vitest-plugin` — 実 workerd 上で動作する
  (unit: `src/shared/permissions.test.ts` / integration: `src/server/app.test.ts`)
  - テストは `wrangler.jsonc` を利用し、`migrations/*.sql` を D1 に適用してから実行
- **typecheck**: `npm run check:types`
- まとめて実行: `npm run check`
- `wrangler.jsonc` を変更したら `npx wrangler types` で `worker-configuration.d.ts` を更新

## 本番デプロイ(初回)

```bash
wrangler login

# 1. D1 データベースを作成し、wrangler.jsonc の database_id を置き換える
npx wrangler d1 create banrai-db

# 2. メール送信を有効化 (ドメインのスペル自由、例: banrai.example.com)
npx wrangler email sending enable <your-domain>

# 3. リモートにマイグレーション適用
npm run migrations:apply:remote

# 4. シークレット設定
echo "<生成した秘密値>" | npx wrangler secret put BETTER_AUTH_SECRET

# 5. デプロイ (workers.dev の場合。カスタムドメインは Dashboard で追加し BETTER_AUTH_URL vars を更新)
npm run deploy
```

### システム管理者 (platform admin) の発行

`BOOTSTRAP_ADMIN_EMAIL` vars (秘密) を設定した状態で、そのメールアドレスで新規登録すると
`admin` ロール(プラグイン管理画面による全ユーザー管理)が付与されます。

```bash
npx wrangler secret put BOOTSTRAP_ADMIN_EMAIL   # 例: you@example.com
```

登録後は該当 vars/secret を削除してください。

### SaaS のテスト手順 (ローカル)

1. `/` で新規登録 (会社) → 事業者を作成
2. 「サービス」タブで提供サービス登録 (ex: エアコンクリーニング)
3. 「スタッフ」タブで staff を招待 (E メールが届く: ローカルはログ)
4. 招待 URL `/accept-invitation?id=...` で承諾 → パスワード設定
5. 「ロール」タブでカスタムロールを作成 (Dynamic Access Control)
6. 「作業」タブで作業作成 → staff に割り当て

## CI (GitHub Actions)

`.github/workflows/deploy.yml` が main への push で:
マイグレーション → secret 投入 → wrangler deploy を実行します。
リポジトリの Actions secrets に以下を設定:

| Secret                  | 説明                                            |
| ----------------------- | ----------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Workers Scripts:Edit / D1:Edit 権限の API token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID                           |
| `BETTER_AUTH_SECRET`    | 本番用シークレット                              |

## スキーマ再生成

better-auth のプラグイン構成を変えたとき:

```bash
node scripts/generate-auth-schema.mjs
# → migrations/0000_auth_schema.sql を書き換え。既存 DB には必ず手動 SQL で差分適用
```
