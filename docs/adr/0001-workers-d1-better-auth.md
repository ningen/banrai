# ADR-0001: Cloudflare Workers + D1 + better-auth で構成する

Status: Accepted (2026-08-27)

## Context

- 清掃事業者向け SaaS: 事業者(org)ごとにスタッフ・作業・カレンダーを持つ多テナント構成
- 要件: サーバーレスで運用コスト低減、認証と動的ロール (事業者ごとの権限定義) が必要

## Decision

- ランタイム: Cloudflare Workers (Hono) + 静的アセット配信
- DB: Cloudflare D1 (SQLite)。業務テーブルは snake_case、better-auth 系は camelCase で共存
- 認証: better-auth v1.7 — admin (platform 管理者) + organization plugin (事業者 = org) +
  Dynamic Access Control (事業者ごとのカスタムロールを `organizationRole` に保存)
- 権限チェック: `auth.api.hasPermission` (hasPermission エンドポイント) を `guard()` + `can()` でラップ
- メール: Cloudflare Email Service (`send_email` バインディング)
- UI: Vite + React SPA を Workers の静的アセットとして配信

## Consequences

- デプロイは単一 Worker で完結 (migrations apply → deploy)
- D1 の制約: マイグレーションは SQL ファイル管理、TTL なし、ホットデータは自前で削除する
- better-auth のサーバー API は一部セッション前提のため、デモシードは直接 SQL で行う (routes.ts 参照)
- マルチリージョン分散より単純さを優先
