/**
 * 三個 server component 嘅租戶隔離測試。
 *
 * `t/[token]/page.tsx`、`editor/[id]/page.tsx`、`menu/[id]/page.tsx` 各有一句
 * `.eq("client_id", tenant.id)` —— service role 繞過 RLS，整個頁面層嘅隔離
 * 就係靠呢三行。API 層已經測得好齊，但頁面層之前冇任何測試守住，
 * 即係下次有人改呢三條查詢，CI 會全綠。
 *
 * 呢個檔案嘅要求：**拎走任何一條 `.eq("client_id", …)`，必須有測試變紅。**
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tenant } from "@/lib/tenant/types";

// ---- notFound()：Next.js 會拋特製 error，測試用認得出嘅替身 ----
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
const notFound = vi.fn(() => {
  throw new NotFoundError();
});
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

// ---- 記憶體版 Supabase fake：會真係按 .eq 過濾，先測得到隔離 ----
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const calls: { table: string; filters: [string, unknown][] }[] = [];
let failError: { message: string; code?: string } | null = null;

function builder(table: string) {
  const filters: [string, unknown][] = [];
  let single = false;
  let embed = false;

  const run = () => {
    calls.push({ table, filters: [...filters] });
    if (failError) return { data: null, error: failError };
    const rows = db[table] ?? [];
    let out = rows.filter((r) => filters.every(([k, v]) => r[k] === v));
    // 模擬 PostgREST embed：菜式只會跟住已被過濾嘅 parent 出
    if (embed) {
      out = out.map((r) => ({
        ...r,
        menu_items: (db.menu_items ?? []).filter((m) => m.restaurant_id === r.id),
      }));
    }
    return single ? { data: out[0] ?? null, error: null } : { data: out, error: null };
  };

  const b: Record<string, unknown> = {
    select: (cols?: string) => {
      if (typeof cols === "string" && cols.includes("menu_items(*)")) embed = true;
      return b;
    },
    eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
    order: () => b,
    maybeSingle: () => { single = true; return b; },
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve().then(run).then(res, rej),
  };
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (t: string) => builder(t) }),
}));

// ---- 租戶解析：真實行為（查唔到 → notFound）喺 params.test.ts 已覆蓋，
//      呢度只需要由 token 攞返對應租戶。 ----
const tenantOf = (token: string) => [A, B].find((t) => t.token === token);
vi.mock("@/lib/tenant/params", () => ({
  getTenantFromParams: async (params: Promise<{ token: string }>) => {
    const { token } = await params;
    const tenant = tenantOf(token);
    if (!tenant) notFound();
    return tenant;
  },
}));

import TenantHomePage from "./page";
import EditEditorPage from "./editor/[id]/page";
import MenuPage from "./menu/[id]/page";

const tenant = (over: Partial<Tenant>): Tenant => ({
  id: "tenant-a",
  token: "aaaaaaaaaaaa",
  name: "甲餐廳",
  logoText: "A",
  logoUrl: null,
  primaryColor: "#112233",
  backgrounds: ["gold-landscape"],
  allowBrandMarks: false,
  brandPrompt: null,
  ...over,
});

const A = tenant({});
const B = tenant({ id: "tenant-b", token: "bbbbbbbbbbbb", name: "乙餐廳" });

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

const params = (p: unknown) => Promise.resolve(p) as never;

/** 喺 React element 樹入面搵第一個帶住 `prop` 嘅 props 值（唔使 render） */
function findProp<T>(node: unknown, prop: string): T | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findProp<T>(child, prop);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  const props = (node as { props?: Record<string, unknown> }).props;
  if (!props) return undefined;
  if (prop in props) return props[prop] as T;
  return findProp<T>(props.children, prop);
}

const restaurantsQuery = () => calls.find((c) => c.table === "restaurants")!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  calls.length = 0;
  failError = null;
  for (const k of Object.keys(db)) delete db[k];
  db.restaurants = [
    { id: ID_A, client_id: A.id, name: "A 店", theme: "classic", background: "none", poster_url: null, created_at: "1" },
    { id: ID_B, client_id: B.id, name: "B 店", theme: "classic", background: "none", poster_url: null, created_at: "2" },
  ];
  db.menu_items = [
    { id: "ia", restaurant_id: ID_A, name: "A 菜", price: 10, image_url: null, sort_order: 0 },
    { id: "ib", restaurant_id: ID_B, name: "B 菜", price: 20, image_url: null, sort_order: 0 },
  ];
});

describe("租戶首頁 /t/[token]", () => {
  it("只列到自己租戶嘅記錄，見唔到第二個租戶嘅", async () => {
    const el = await TenantHomePage({ params: params({ token: A.token }) });
    const list = findProp<Row[]>(el, "restaurants");
    expect(list).toBeDefined();
    expect(list!.map((r) => r.id)).toEqual([ID_A]);
    expect(list!.map((r) => r.name)).not.toContain("B 店");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("查詢一定帶 client_id", async () => {
    await TenantHomePage({ params: params({ token: A.token }) });
    expect(restaurantsQuery().filters).toContainEqual(["client_id", A.id]);
  });

  it("換另一個租戶就只見到對方嘅記錄", async () => {
    const el = await TenantHomePage({ params: params({ token: B.token }) });
    expect(findProp<Row[]>(el, "restaurants")!.map((r) => r.id)).toEqual([ID_B]);
  });
});

describe("編輯頁 /t/[token]/editor/[id]", () => {
  it("自己嘅記錄載入得到", async () => {
    const el = await EditEditorPage({ params: params({ token: A.token, id: ID_A }) });
    expect(notFound).not.toHaveBeenCalled();
    expect(findProp<{ name: string }>(el, "initial")!.name).toBe("A 店");
    expect(restaurantsQuery().filters).toContainEqual(["client_id", A.id]);
  });

  it("用第二個租戶嘅 id → notFound()，菜式亦唔會洩露", async () => {
    await expect(
      EditEditorPage({ params: params({ token: A.token, id: ID_B }) })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalled();
    expect(restaurantsQuery().filters).toContainEqual(["client_id", A.id]);
  });

  it("DB 錯誤唔會洩露原文，但照樣拋上 error boundary", async () => {
    failError = { message: "SECRET_DB_DETAIL", code: "XX000" };
    const call = EditEditorPage({ params: params({ token: A.token, id: ID_A }) });
    await expect(call).rejects.toThrow(/讀取餐牌失敗/);
    await expect(call).rejects.not.toThrow(/SECRET_DB_DETAIL/);
    expect(console.error).toHaveBeenCalled();
  });

  it("22P02（id 唔係合法 uuid）→ notFound() 而唔係拋錯", async () => {
    failError = { message: "invalid input syntax for type uuid", code: "22P02" };
    await expect(
      EditEditorPage({ params: params({ token: A.token, id: "not-a-uuid" }) })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("展示頁 /t/[token]/menu/[id]", () => {
  it("自己嘅記錄顯示得到", async () => {
    const el = await MenuPage({ params: params({ token: A.token, id: ID_A }) });
    expect(notFound).not.toHaveBeenCalled();
    const items = findProp<{ name: string }[]>(el, "items");
    expect(items!.map((i) => i.name)).toEqual(["A 菜"]);
    expect(restaurantsQuery().filters).toContainEqual(["client_id", A.id]);
  });

  it("用第二個租戶嘅 id → notFound()，菜式亦唔會洩露", async () => {
    await expect(
      MenuPage({ params: params({ token: A.token, id: ID_B }) })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(notFound).toHaveBeenCalled();
    expect(restaurantsQuery().filters).toContainEqual(["client_id", A.id]);
  });

  it("DB 錯誤唔會洩露原文，但照樣拋上 error boundary", async () => {
    failError = { message: "SECRET_DB_DETAIL", code: "XX000" };
    const call = MenuPage({ params: params({ token: A.token, id: ID_A }) });
    await expect(call).rejects.toThrow(/讀取餐牌失敗/);
    await expect(call).rejects.not.toThrow(/SECRET_DB_DETAIL/);
    expect(console.error).toHaveBeenCalled();
  });

  it("22P02（id 唔係合法 uuid）→ notFound() 而唔係拋錯", async () => {
    failError = { message: "invalid input syntax for type uuid", code: "22P02" };
    await expect(
      MenuPage({ params: params({ token: A.token, id: "not-a-uuid" }) })
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
