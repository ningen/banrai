# ADR-0006: UI トークンシステム (Paper & Ink Indigo)

Status: Accepted (2026-08-27)

## Context

- 毎日使う業務アプリとして「シンプルだが質実剛健」な方向性が望まれた
- フォント/配色の壁打ち (モック比較ボード) を経て決定

## Decision

- 配色: Paper & Ink Indigo — 紙白 `#F7F7F5` / 墨 `#1B1B19` / 藍 `#2753E4`
  - サービス色は 6 色プリセット (エアコン=水色 / ハウス=琥珀 / フード=紫 等)
- フォント: IBM Plex Sans + IBM Plex Sans JP (Fontsource でセルフホスト)
- 数字は `tabular-nums` を適用
- 実装: Tailwind v4 (`@theme inline` でトークンを utilities 化) +
  shadcn/ui コンポーネント (button/badge/card/input/label/textarea/select/dialog/sheet/sonner/popover)
- カレンダー・カンバン等の業務部品はカスタム CSS (styles.css) で管理

## Consequences

- Storybook (`.storybook/`) は viteFinal で alias + tailwind を注入、`@source "./"` でスキャン
- Tailwind の自動ソーススキャンが効かない環境 (Storybook dev) では `@source` 指定が必須
- 新規 UI 部品は shadcn 由来を優先し、独自表現のみ自前 CSS に足す