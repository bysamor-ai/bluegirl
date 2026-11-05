import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// ---- 記憶體版 Supabase fake：會真係按 .eq 過濾，先測得到隔離 ----
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const calls: { table: string; op: string; payload?: unknown; filters: [string, unknown][] }[] = [];
let failTable: string | null = null;
let failCode: string | undefined;
let idSeq = 0;

function builder(table: string) {
  let op = "select";
  let payload: unknown;
  const filters: [string, unknown][] = [];
  let returning = false;
  let single: "single" | "maybe" | null = null;
  let embedItems = false;

  const run = () => {
    calls.push({ table, op, payload, filters: [...filters] });
    if (failTable === table) return { data: null, error: { message: "SECRET_DB_DETAIL", code: failCode } };
    const matches = (r: Row) => filters.every(([k, v]) => r[k] === v);
    const rows = db[table] ?? (db[table] = []);
    let out: Row[] = [];
    if (op === "select") {
      out = rows.filter(matches);
      // 模擬 PostgREST embed：菜式只會跟住已被過濾嘅 parent 出
      if (embedItems) {
        out = out.map((r) => ({
          ...r,
          menu_items: (db.menu_items ?? []).filter((m) => m.restaurant_id === r.id),
        }));
      }
    }
    if (op === "insert") {
      const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
      out = list.map((r) => ({ id: `new-${++idSeq}`, ...r }));
      rows.push(...out);
    }
    if (op === "update") {
      out = rows.filter(matches);
      out.forEach((r) => Object.assign(r, payload));
    }
    if (op === "delete") {
      out = rows.filter(matches);
      db[table] = rows.filter((r) => !matches(r));
    }
    if (op !== "select" && !returning) return { data: null, error: null };
    if (single === "single") return out[0] ? { data: out[0], error: null } : { data: null, error: { message: "none" } };
    if (single === "maybe") return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  };

  const b: Record<string, unknown> = {
    select: (cols?: string) => {
      if (op !== "select") returning = true;
      if (typeof cols === "string" && cols.includes("menu_items(*)")) embedItems = true;
      return b;
    },
    insert: (p: unknown) => { op = "insert"; payload = p; return b; },
    update: (p: unknown) => { op = "update"; payload = p; return b; },
    delete: () => { op = "delete"; return b; },
    eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
    order: () => b,
    single: () => { single = "single"; return b; },
    maybeSingle: () => { single = "maybe"; return b; },
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve().then(run).then(res, rej),
  };
  return b;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({ from: (t: string) => builder(t) }),
}));

const getTenantByToken = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({
  getTenantByToken: (t: string) => getTenantByToken(t),
}));

import { GET, POST } from "./route";
import { GET as GET_ONE, DELETE } from "./[id]/route";

const A = { id: "tenant-a", token: "aaaaaaaaaaaa" };
const B = { id: "tenant-b", token: "bbbbbbbbbbbb" };
const ID_B = "22222222-2222-4222-8222-222222222222";

const ctx = (params: unknown) => ({ params: Promise.resolve(params) }) as never;
const req = (body?: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

const validBody = {
  name: "新店",
  theme: "classic",
  background: "none",
  posterUrl: "",
  items: [{ name: "叉燒飯", price: 50, imageUrl: "" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  calls.length = 0;
  failTable = null;
  failCode = undefined;
  idSeq = 0;
  for (const k of Object.keys(db)) delete db[k];
  db.restaurants = [
    { id: "ra", client_id: A.id, name: "A 店", created_at: "1" },
    { id: ID_B, client_id: B.id, name: "B 店", created_at: "2" },
  ];
  db.menu_items = [
    { id: "ia", restaurant_id: "ra", name: "A 菜" },
    { id: "ib", restaurant_id: ID_B, name: "B 菜" },
  ];
  getTenantByToken.mockImplementation(async (t: string) =>
    t === A.token ? A : t === B.token ? B : null
  );
});

describe("token 驗證", () => {
  it("token 查唔到回 404 JSON", async () => {
    const res = await GET(req(), ctx({ token: "zzzzzzzzzzzz" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });

  it.each([[undefined], [["a", "b"]], [123]])("token 非 string（%j）回 404 而唔係拋錯", async (bad) => {
    const res = await GET(req(), ctx({ token: bad }));
    expect(res.status).toBe(404);
    expect(getTenantByToken).not.toHaveBeenCalled();
  });

  it("租戶查詢 DB 故障回 500，唔係 404，亦唔洩露內部訊息", async () => {
    getTenantByToken.mockRejectedValue(new Error("未設定環境變數 SUPABASE_SERVICE_ROLE_KEY"));
    const res = await GET(req(), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("SUPABASE");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("GET /restaurants", () => {
  it("只回該租戶嘅記錄，查詢帶 client_id", async () => {
    const res = await GET(req(), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    const { restaurants } = await res.json();
    expect(restaurants.map((r: Row) => r.id)).toEqual(["ra"]);
    const q = calls.find((c) => c.table === "restaurants")!;
    expect(q.filters).toContainEqual(["client_id", A.id]);
  });

  it("DB 錯誤回通用 500，唔洩露細節", async () => {
    failTable = "restaurants";
    const res = await GET(req(), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET_DB_DETAIL");
  });
});

describe("POST /restaurants", () => {
  it("新增：用 server 由 token 推導嘅 client_id，無視 body 夾帶嘅", async () => {
    const res = await POST(
      req({ ...validBody, client_id: B.id, clientId: B.id }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(200);
    const ins = calls.find((c) => c.table === "restaurants" && c.op === "insert")!;
    expect((ins.payload as Row).client_id).toBe(A.id);
    expect(db.restaurants.filter((r) => r.client_id === B.id)).toHaveLength(1);
  });

  it("更新其他租戶嘅 id 回 404，菜式同餐廳原封不動", async () => {
    const before = JSON.stringify(db);
    const res = await POST(
      req({ ...validBody, id: ID_B, client_id: B.id }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(404);
    expect(JSON.stringify(db)).toBe(before);
    expect(calls.some((c) => c.table === "menu_items" && c.op === "delete")).toBe(false);
  });

  it("更新自己嘅記錄：唔會改 client_id，菜式整批重寫", async () => {
    const res = await POST(
      req({ ...validBody, id: "00000000-0000-4000-8000-000000000000", client_id: B.id }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(404); // 非自己嘅 id（唔存在）亦 404，唔會順手新增
    db.restaurants.push({ id: "11111111-1111-4111-8111-111111111111", client_id: A.id, name: "x" });
    db.menu_items.push({ id: "ix", restaurant_id: "11111111-1111-4111-8111-111111111111", name: "舊" });
    const ok = await POST(
      req({ ...validBody, id: "11111111-1111-4111-8111-111111111111", client_id: B.id }),
      ctx({ token: A.token })
    );
    expect(ok.status).toBe(200);
    const upd = calls.find((c) => c.table === "restaurants" && c.op === "update")!;
    expect(upd.payload).not.toHaveProperty("client_id");
    expect(upd.filters).toContainEqual(["client_id", A.id]);
    expect(db.menu_items.filter((m) => m.restaurant_id === "11111111-1111-4111-8111-111111111111").map((m) => m.name)).toEqual(["叉燒飯"]);
    expect(db.menu_items.find((m) => m.id === "ib")).toBeDefined();
  });

  it.each([
    [{ name: "" }],
    [{ ...validBody, id: "not-a-uuid" }],
    [{ name: "x", theme: "classic", background: "none", posterUrl: "" }],
  ])("body 格式錯回 400 + 固定繁中訊息（唔洩露 zod 英文／欄位名）", async (bad) => {
    const res = await POST(req(bad), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error).toBe("提交嘅資料格式不正確");
    expect(error).not.toMatch(/Invalid|Required|items|uuid/);
  });

  it("DB 錯誤回通用 500，唔洩露細節", async () => {
    failTable = "restaurants";
    const res = await POST(req(validBody), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET_DB_DETAIL");
  });
});

describe("GET /restaurants/[id]", () => {
  it("自己嘅記錄回 200", async () => {
    const res = await GET_ONE(req(), ctx({ token: A.token, id: "ra" }));
    expect(res.status).toBe(200);
    const { restaurant } = await res.json();
    expect(restaurant.id).toBe("ra");
    expect(restaurant.menu_items.map((m: Row) => m.id)).toEqual(["ia"]);
  });

  it("唔屬於該租戶回 404（唔係 403）", async () => {
    const res = await GET_ONE(req(), ctx({ token: A.token, id: ID_B }));
    expect(res.status).toBe(404);
    const q = calls.find((c) => c.table === "restaurants")!;
    expect(q.filters).toContainEqual(["client_id", A.id]);
    // 連菜式都唔可以漏出去
    expect(JSON.stringify(await res.json())).not.toContain("B 菜");
  });

  it("非 uuid 格式嘅 id（Postgres 22P02）回 404", async () => {
    failTable = "restaurants";
    failCode = "22P02";
    const res = await GET_ONE(req(), ctx({ token: A.token, id: "not-a-uuid" }));
    expect(res.status).toBe(404);
  });

  it("其他 DB 錯誤回 500", async () => {
    failTable = "restaurants";
    failCode = "XX000";
    const res = await GET_ONE(req(), ctx({ token: A.token, id: "ra" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET_DB_DETAIL");
  });
});

describe("DELETE /restaurants/[id]", () => {
  it("唔屬於該租戶回 404 而且冇刪到嘢", async () => {
    const res = await DELETE(req(), ctx({ token: A.token, id: ID_B }));
    expect(res.status).toBe(404);
    expect(db.restaurants.map((r) => r.id)).toContain(ID_B);
    expect(db.menu_items.map((m) => m.id)).toContain("ib");
  });

  it("自己嘅記錄刪得到", async () => {
    const res = await DELETE(req(), ctx({ token: A.token, id: "ra" }));
    expect(res.status).toBe(200);
    expect(db.restaurants.map((r) => r.id)).toEqual([ID_B]);
  });

  it("非 uuid 格式嘅 id（Postgres 22P02）回 404", async () => {
    failTable = "restaurants";
    failCode = "22P02";
    const res = await DELETE(req(), ctx({ token: A.token, id: "not-a-uuid" }));
    expect(res.status).toBe(404);
  });

  it("DB 錯誤回通用 500", async () => {
    failTable = "restaurants";
    const res = await DELETE(req(), ctx({ token: A.token, id: "ra" }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET_DB_DETAIL");
  });
});
