import type { Auth } from "./auth";
import { ensureDefaultStatuses } from "./statuses";

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "Demopass123!";

const DEMO_USERS = [
  { email: DEMO_EMAIL, name: "デモ事業主", role: "owner" },
  { email: "yamada@example.com", name: "山田 健", role: "リーダー" },
  { email: "sato@example.com", name: "佐藤 あきら", role: "member" },
  { email: "tanaka@example.com", name: "田中 千尋", role: "admin" },
];

const ORG = { name: "デモ清掃サービス", slug: "demo-clean" };

const SERVICES: [string, string, number, number, { name: string; price: number }[]][] = [
  [
    "エアコンクリーニング",
    "#29A3E8",
    90,
    12100,
    [
      { name: "室外機", price: 3300 },
      { name: "グリル洗浄", price: 2200 },
    ],
  ],
  [
    "ハウスクリーニング",
    "#E8A33D",
    180,
    16500,
    [
      { name: "ベランダ", price: 5500 },
      { name: "水回りブースト", price: 4400 },
    ],
  ],
  ["レンジフード", "#8A6BE0", 60, 8800, [{ name: "配管クリーニング", price: 4400 }]],
];

const CUSTOMERS: {
  name: string;
  phones: string[];
  emails: string[];
  addresses: { postal: string; prefecture: string; city: string; rest: string }[];
}[] = [
  {
    name: "丸山マンション 303",
    phones: ["090-1234-5678", "03-1234-5678"],
    emails: ["maruyama@example.com"],
    addresses: [
      { postal: "150-0002", prefecture: "東京都", city: "渋谷区", rest: "丸山1-2-3" },
      { postal: "150-0003", prefecture: "東京都", city: "渋谷区", rest: "丸山4-5-6 別館" },
    ],
  },
  {
    name: "佐藤様 戸建",
    phones: ["080-9876-5432"],
    emails: ["sato@example.com"],
    addresses: [{ postal: "", prefecture: "東京都", city: "世田谷区", rest: "宇田川2-3-4" }],
  },
  {
    name: "青木荘 203",
    phones: ["070-1111-2222"],
    emails: [],
    addresses: [{ postal: "", prefecture: "神奈川県", city: "横浜市", rest: "青木5-6" }],
  },
];

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstDateISO(ms: number): string {
  const d = new Date(ms + JST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// カレンダー日付は JST (Asia/Tokyo) 固定
function todayISO(): string {
  return jstDateISO(Date.now());
}

function tomorrowISO(): string {
  return jstDateISO(Date.now() + 86400000);
}

async function userByEmail(env: Env, email: string): Promise<string | null> {
  const row = (await env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(email).first()) as {
    id: string;
  } | null;
  return row?.id ?? null;
}

export async function ensureDemo(env: Env, auth: Auth): Promise<{ orgId: string }> {
  // 1. users (idempotent; signUp errors on duplicates are ignored)
  const userIds = new Map<string, string>();
  for (const u of DEMO_USERS) {
    let id = await userByEmail(env, u.email);
    if (!id) {
      try {
        await auth.api.signUpEmail({
          body: { email: u.email, password: DEMO_PASSWORD, name: u.name },
          headers: { origin: env.BETTER_AUTH_URL },
        });
        id = await userByEmail(env, u.email);
      } catch {
        id = await userByEmail(env, u.email);
      }
    }
    if (id) userIds.set(u.role, id);
  }

  // 2. organization (SQL insert — server API requires a session)
  let org = (await env.DB.prepare("SELECT id FROM organization WHERE slug = ?")
    .bind(ORG.slug)
    .first()) as { id: string } | null;
  if (!org) {
    const newId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT OR IGNORE INTO organization (id, name, slug, createdAt) VALUES (?,?,?,?)",
    )
      .bind(newId, ORG.name, ORG.slug, Date.now())
      .run();
    const ownerId = userIds.get("owner");
    if (ownerId) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO member (id, organizationId, userId, role, createdAt) VALUES (?,?,?,'owner',?)",
      )
        .bind(crypto.randomUUID(), newId, ownerId, Date.now())
        .run();
    }
    org = (await env.DB.prepare("SELECT id FROM organization WHERE slug = ?")
      .bind(ORG.slug)
      .first()) as { id: string } | null;
  }
  const orgId = org!.id;

  await ensureDefaultStatuses(env, orgId);

  // 3. members (SQL; org create already added owner)
  for (const u of DEMO_USERS) {
    const userId = userIds.get(u.role);
    if (!userId || u.role === "owner") continue;
    const exists = await env.DB.prepare(
      "SELECT id FROM member WHERE organizationId = ? AND userId = ?",
    )
      .bind(orgId, userId)
      .first();
    if (!exists) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO member (id, organizationId, userId, role, createdAt) VALUES (?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          orgId,
          userId,
          u.role === "リーダー" ? "member" : u.role,
          Date.now(),
        )
        .run();
    }
  }

  // 4. custom role リーダー (dynamic access control)
  const roleExists = await env.DB.prepare(
    "SELECT id FROM organizationRole WHERE organizationId = ? AND role = ?",
  )
    .bind(orgId, "リーダー")
    .first();
  if (!roleExists) {
    await env.DB.prepare(
      "INSERT INTO organizationRole (id, organizationId, role, permission, createdAt) VALUES (?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        orgId,
        "リーダー",
        JSON.stringify({
          job: ["read", "update", "assign"],
          service: ["read"],
          assignment: ["read", "update"],
        }),
        Date.now(),
      )
      .run();
  }

  // assign リーダー role to 山田
  const yamada = userIds.get("リーダー");
  if (yamada) {
    await env.DB.prepare("UPDATE member SET role = ? WHERE organizationId = ? AND userId = ?")
      .bind("リーダー", orgId, yamada)
      .run();
  }

  // 5. services (with price/options)
  const svcCount = (await env.DB.prepare("SELECT COUNT(*) AS c FROM services WHERE org_id = ?")
    .bind(orgId)
    .first()) as { c: number };
  if (!svcCount.c) {
    const now = Date.now();
    for (const [name, color, durationMin, price, options] of SERVICES) {
      await env.DB.prepare(
        "INSERT INTO services (id, org_id, name, description, duration_min, color, price, options, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          orgId,
          name,
          "",
          durationMin,
          color,
          price,
          JSON.stringify(options),
          now,
          now,
        )
        .run();
    }
  }

  // 5b. customers
  const customerCount = (await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM customers WHERE org_id = ?",
  )
    .bind(orgId)
    .first()) as { c: number };
  if (!customerCount.c) {
    const now = Date.now();
    for (const cs of CUSTOMERS) {
      await env.DB.prepare(
        "INSERT INTO customers (id, org_id, name, phones, emails, addresses, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          orgId,
          cs.name,
          JSON.stringify(cs.phones),
          JSON.stringify(cs.emails),
          JSON.stringify(cs.addresses),
          "",
          now,
          now,
        )
        .run();
    }
  }

  // 6. sample jobs for today/tomorrow (only when empty)
  const jobCount = (await env.DB.prepare("SELECT COUNT(*) AS c FROM jobs WHERE org_id = ?")
    .bind(orgId)
    .first()) as { c: number };
  if (jobCount.c === 0) {
    const now = Date.now();

    const serviceIds = new Map<string, string>();
    const rows = (await env.DB.prepare("SELECT name, id FROM services WHERE org_id = ?")
      .bind(orgId)
      .all()) as any;
    for (const r of rows.results ?? []) serviceIds.set(r.name, r.id);

    const yamadaId = userIds.get("リーダー")!;
    const satoId = userIds.get("member")!;
    const tanakaId = userIds.get("admin")!;

    const customerIds = new Map<
      string,
      { id: string; address: { postal: string; prefecture: string; city: string; rest: string } }
    >();
    const custRows = (await env.DB.prepare(
      "SELECT id, name, addresses FROM customers WHERE org_id = ?",
    )
      .bind(orgId)
      .all()) as any;
    for (const r of custRows.results ?? []) {
      const list = JSON.parse(r.addresses || "[]") as unknown[];
      customerIds.set(r.name, { id: r.id, address: normalizeDemoAddress(list[0]) });
    }

    const today = todayISO();
    const tomorrow = tomorrowISO();

    const jobs: {
      customer: string;
      svc: string;
      date: string;
      start: number;
      dur: number;
      status: string;
      notes: string;
      staff?: string;
    }[] = [
      {
        customer: "丸山マンション 303",
        svc: "エアコンクリーニング",
        date: today,
        start: 540,
        dur: 90,
        status: "割当日",
        notes: "室外機は2階",
        staff: yamadaId,
      },
      {
        customer: "佐藤様 戸建",
        svc: "ハウスクリーニング",
        date: today,
        start: 600,
        dur: 180,
        status: "割当日",
        notes: "2名対応",
        staff: satoId,
      },
      {
        customer: "青木荘 203",
        svc: "エアコンクリーニング",
        date: today,
        start: 780,
        dur: 60,
        status: "割当日",
        notes: "",
        staff: tanakaId,
      },
      {
        customer: "しまむら商店",
        svc: "ハウスクリーニング",
        date: today,
        start: 660,
        dur: 60,
        status: "下書き",
        notes: "時間要相談",
        staff: undefined,
      },
      {
        customer: "高橋ビル 501",
        svc: "レンジフード",
        date: tomorrow,
        start: 600,
        dur: 60,
        status: "割当日",
        notes: "",
        staff: yamadaId,
      },
      {
        customer: "くらし工房",
        svc: "エアコンクリーニング",
        date: tomorrow,
        start: 840,
        dur: 120,
        status: "下書き",
        notes: "電話予約あり",
        staff: undefined,
      },
    ];

    for (const j of jobs) {
      const id = crypto.randomUUID();
      const cust = customerIds.get(j.customer as string);
      const addr = cust?.address ?? { postal: "", prefecture: "", city: "", rest: "" };
      const joined = [addr.prefecture, addr.city, addr.rest].filter(Boolean).join("");
      await env.DB.prepare(
        "INSERT INTO jobs (id, org_id, service_id, customer_id, customer_name, address, address_postal, address_prefecture, address_city, address_rest, scheduled_date, start_minute, duration_min, status, notes, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          id,
          orgId,
          serviceIds.get(j.svc) ?? null,
          cust?.id ?? null,
          j.customer,
          addr.postal ? `〒${addr.postal} ${joined}` : joined,
          addr.postal,
          addr.prefecture,
          addr.city,
          addr.rest,
          j.date,
          j.start,
          j.dur,
          j.status,
          j.notes,
          userIds.get("owner") ?? null,
          now,
          now,
        )
        .run();
      if (j.staff) {
        await env.DB.prepare(
          "INSERT INTO job_assignments (id, org_id, job_id, member_id, created_at) VALUES (?,?,?,?,?)",
        )
          .bind(crypto.randomUUID(), orgId, id, j.staff, now)
          .run();
      }
    }
  }

  return { orgId };
}

export const DEMO_LOGIN = { email: DEMO_EMAIL, password: DEMO_PASSWORD };

function normalizeDemoAddress(value: unknown): {
  postal: string;
  prefecture: string;
  city: string;
  rest: string;
} {
  if (typeof value === "string") {
    const prefs = [
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
    const pref = prefs.find((p) => value.startsWith(p)) ?? "";
    const body = pref ? value.slice(pref.length) : value;
    return { postal: "", prefecture: pref, city: body, rest: "" };
  }
  if (typeof value === "object" && value !== null) {
    const a = value as Record<string, unknown>;
    return {
      postal: String(a.postal ?? ""),
      prefecture: String(a.prefecture ?? ""),
      city: String(a.city ?? ""),
      rest: String(a.rest ?? ""),
    };
  }
  return { postal: "", prefecture: "", city: "", rest: "" };
}
