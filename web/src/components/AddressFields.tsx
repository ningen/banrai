import type { CustomerAddress } from "../types";
import { Input } from "./ui/input";

export const PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

export function splitAddress(s: string): CustomerAddress {
  const pref = PREFECTURES.find((p) => s.startsWith(p)) ?? "";
  const body = pref ? s.slice(pref.length) : s;
  const m = body.match(/^(.+?[市区郡町村])(.*)$/);
  return {
    postal: "",
    prefecture: pref,
    city: m ? m[1]! : body,
    rest: m && m[2] ? m[2] : "",
  };
}

export function AddressFields({
  value,
  onChange,
}: {
  value: CustomerAddress;
  onChange: (next: CustomerAddress) => void;
}) {
  const set = (field: keyof CustomerAddress, v: string) => onChange({ ...value, [field]: v });
  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        className="num"
        placeholder="〒 郵便番号"
        value={value.postal}
        onChange={(e) => set("postal", e.target.value)}
      />
      <Input
        placeholder="都道府県 (ex: 東京都)"
        value={value.prefecture}
        onChange={(e) => set("prefecture", e.target.value)}
      />
      <Input
        placeholder="市区町村 (ex: 渋谷区)"
        value={value.city}
        onChange={(e) => set("city", e.target.value)}
      />
      <Input
        placeholder="以降 (町名・番地・建物)"
        value={value.rest}
        onChange={(e) => set("rest", e.target.value)}
      />
    </div>
  );
}
