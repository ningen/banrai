# ADR-0005: 顧客の複数連絡先と構造化住所

Status: Accepted (2026-08-27)

## Context

- 顧客は複数の電話・メール・住所を持ちうる (個人/法人、別宅、物件複数)
- 作業作成時は「どの住所に何時に行くか」を選ぶ必要がある
- 住所は郵便番号/都道府県/市区町村/以降に分けて入力・表示したい

## Decision

- `customers.phones` / `emails` / `addresses` は JSON 配列カラム (migration 0003)
  - phones / emails: 文字列配列
  - addresses: `{ postal, prefecture, city, rest }` のオブジェクト配列 (migration 0004 以降構造化、
    旧文字列データは読み取り時に正規化)
- `jobs` は住所を構造化カラムで保存 (migration 0005):
  `address_postal / address_prefecture / address_city / address_rest` + 互換用 `address`
- 作業作成時: 顧客選択 → 連絡先・住所のどれを使うかをドロップダウンで選び、
  4 パーツをそのまま作業へコピー。顧客未選択時は 4 分割入力から結合保存
- API は zod でパースし、JSON カラムは必ず parse/stringify してから返す/書き込む

## Consequences

- 検索 (q) は構造化カラム (住所系) も LIKE 対象
- ローンチ前であり、旧形式は読み取り時変換で吸収 (migration 不要の互換層)
