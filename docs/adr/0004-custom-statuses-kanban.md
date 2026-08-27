# ADR-0004: 任意ステータスとカンバン

Status: Accepted (2026-08-27)

## Context

- 作業の進行管理を事業者ごとに柔軟にしたい (固定 draft/assigned/done では足りない)
- カンバン表示とドラッグ&ドロップでの位置・ステータス変更が求められた

## Decision

- `job_statuses` テーブル: name / color / done(完了扱い) / sort_order。事業者ごとに任意作成可
- デフォルト4種 (下書き・割当日・完了・キャンセル) は稼働時に冪等シード
  (`src/server/statuses.ts`)
- `jobs.status` は**ステータス名 (文字列)** で保持。一覧は statuses を JOIN して
  `status_color` / `status_done` を返却
- カンバン (`web/src/pages/JobsPage.tsx`) は @dnd-kit (core + sortable + DragOverlay):
  - 同一列内の並び順は `jobs.position` (10 刻みの index) で永続化
  - ドロップは「カードの上/下」を判定して該当位置へ挿入 (列跨ぎも同じ基準)
  - ステータスメニュー (⋯) によるクリック変更も併用
- 削除は使用中なら拒否 (キャンセル扱い以外)

## Consequences

- 既存データは migration 0004 で日本語ステータス名へ変換済み
- ステータス名は org 内で一意、変更すると過去ログの意味も変わるので削除は厳格に
