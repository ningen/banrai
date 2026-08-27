# ADR-0002: 日付・時刻の JST 固定と保存仕様

Status: Accepted (2026-08-27)

## Context

- 対象市場は日本 (Asia/Tokyo)。workerd 実行環境とブラウザのローカルタイムゾーンが
  異なる場合があり (例: UTC 環境)、「今日の作業」や現在時刻ラインがずれる問題が発生

## Decision

- カレンダー・日付・時刻の表示と保存は **JST (Asia/Tokyo) 固定**
- 保存仕様:
  - `scheduled_date`: JST のカレンダー日 `YYYY-MM-DD` (タイムゾーンを曖昧にしない日付のみ)
  - `start_minute`: JST 0時起点の分数 (0–1439)
  - `created_at` / `updated_at`: epoch ms (タイムゾーン非依存)
- クライアントは `web/src/date.ts` の JST ヘルパーのみ使用
  (`new Date().getDay()` 等のローカル TZ 依存コードは禁止)
- サーバー側の「今日/明日」生成 (デモシード等) も JST で行う

## Consequences

- 端末の TZ 設定に依存しない一貫した運用になる
- ヘルパーは `todayISO / addDays / startOfWeek / datePartsJST / fmtDateJP` 等に集約
- 時刻選択 UI も 30 分刻み (6:00–21:00) と範囲を統一