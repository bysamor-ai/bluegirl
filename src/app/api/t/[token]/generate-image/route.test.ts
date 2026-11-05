import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createFakeDb } from "@/test-utils/fake-db";

const fake = createFakeDb();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => fake.client }));

const falSubscribe = vi.hoisted(() => vi.fn());
vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: falSubscribe, storage: { upload: vi.fn() } },
}));

const getTenantByToken = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({ getTenantByToken: (t: string) => getTenantByToken(t) }));

import { POST } from "./route";

const A = { id: "tenant-a", token: "aaaaaaaaaaaa" };
const B = { id: "tenant-b", token: "bbbbbbbbbbbb" };
const R_A = "11111111-1111-4111-8111-111111111111";
const R_B = "22222222-2222-4222-8222-222222222222";
const I_A = "33333333-3333-4333-8333-333333333333";
const I_B = "44444444-4444-4444-8444-444444444444";

const ctx = (params: unknown) => ({ params: Promise.resolve(params) }) as never;
const req = (body?: unknown, bad = false) =>
  ({
    url: "http://localhost/api/t/x/generate-image",
    json: async () => {
      if (bad) throw new SyntaxError("bad json");
      return body;
    },
  }) as unknown as NextRequest;

const base = { foodName: "叉燒飯" };
const inserts = () => fake.calls.filter((c) => c.table === "generated_images" && c.op === "insert");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.FAL_KEY = "test-fal-key";
  fake.reset();
  fake.db.restaurants = [
    { id: R_A, client_id: A.id },
    { id: R_B, client_id: B.id },
  ];
  fake.db.menu_items = [
    { id: I_A, restaurant_id: R_A },
    { id: I_B, restaurant_id: R_B },
  ];
  getTenantByToken.mockImplementation(async (t: string) =>
    t === A.token ? A : t === B.token ? B : null
  );
  falSubscribe.mockResolvedValue({ data: { images: [{ url: "https://fal.media/x.png" }] } });
});

describe("token / 請求驗證", () => {
  it("token 查唔到 → 404，唔叫 fal", async () => {
    const res = await POST(req(base), ctx({ token: "zzzzzzzzzzzz" }));
    expect(res.status).toBe(404);
    expect(falSubscribe).not.toHaveBeenCalled();
  });

  it("租戶查詢 DB 故障 → 500，唔係 404，唔洩露", async () => {
    getTenantByToken.mockRejectedValue(new Error("SECRET_DB_DETAIL"));
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
  });

  it("JSON 壞 → 400", async () => {
    const res = await POST(req(undefined, true), ctx({ token: A.token }));
    expect(res.status).toBe(400);
  });

  it("schema 唔過 → 400 固定繁中訊息（唔回 zod 英文）", async () => {
    const res = await POST(req({ foodName: "", restaurantId: "not-uuid" }), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/[一-鿿]/);
    expect(falSubscribe).not.toHaveBeenCalled();
  });
});

describe("租戶擁有權驗證", () => {
  it("restaurantId 屬於本租戶 → 成功，並寫入 generated_images", async () => {
    const res = await POST(req({ ...base, restaurantId: R_A }), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect((await res.json()).imageUrl).toBe("https://fal.media/x.png");
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].payload).toMatchObject({ restaurant_id: R_A, menu_item_id: null });
  });

  it("restaurantId 屬於其他租戶 → 404，唔叫 fal，唔寫入", async () => {
    const res = await POST(req({ ...base, restaurantId: R_B }), ctx({ token: A.token }));
    expect(res.status).toBe(404);
    expect(falSubscribe).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it("restaurantId 唔存在 → 404", async () => {
    const res = await POST(
      req({ ...base, restaurantId: "99999999-9999-4999-8999-999999999999" }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(404);
  });

  it("restaurant 查詢用 id + client_id 雙條件", async () => {
    await POST(req({ ...base, restaurantId: R_A }), ctx({ token: A.token }));
    const q = fake.calls.find((c) => c.table === "restaurants");
    expect(q?.filters).toEqual(expect.arrayContaining([["id", R_A], ["client_id", A.id]]));
  });

  it("menuItemId 屬於本租戶（單獨提供）→ 成功，restaurant_id 取自 parent", async () => {
    const res = await POST(req({ ...base, menuItemId: I_A }), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect(inserts()[0].payload).toMatchObject({ restaurant_id: R_A, menu_item_id: I_A });
  });

  it("menuItemId 屬於其他租戶 → 404", async () => {
    const res = await POST(req({ ...base, menuItemId: I_B }), ctx({ token: A.token }));
    expect(res.status).toBe(404);
    expect(falSubscribe).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it("本租戶嘅 restaurantId 配其他租戶嘅 menuItemId → 404", async () => {
    const res = await POST(
      req({ ...base, restaurantId: R_A, menuItemId: I_B }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(404);
    expect(inserts()).toHaveLength(0);
  });

  it("restaurantId 同 menuItemId 各自屬於本租戶但互不相屬 → 404", async () => {
    fake.db.restaurants.push({ id: "55555555-5555-4555-8555-555555555555", client_id: A.id });
    const res = await POST(
      req({ ...base, restaurantId: "55555555-5555-4555-8555-555555555555", menuItemId: I_A }),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(404);
  });

  it("兩者都冇提供 → 唔查資料庫都得，成功，restaurant_id 為 null", async () => {
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect(fake.calls.filter((c) => c.op === "select")).toHaveLength(0);
    expect(inserts()[0].payload).toMatchObject({ restaurant_id: null, menu_item_id: null });
  });

  it("擁有權查詢遇 DB 故障 → 500，唔係 404，唔洩露", async () => {
    fake.failures.add("restaurants");
    const res = await POST(req({ ...base, restaurantId: R_A }), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(falSubscribe).not.toHaveBeenCalled();
  });
});

describe("fal.ai", () => {
  it("冇 FAL_KEY → 500 通用訊息，唔洩露環境變數名", async () => {
    delete process.env.FAL_KEY;
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("FAL_KEY");
  });

  it("fal 拋錯 → 502 通用訊息，詳情只入 console.error", async () => {
    falSubscribe.mockRejectedValue(new Error("SECRET_FAL_DETAIL"));
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(console.error).toHaveBeenCalled();
  });

  it("fal 冇回圖 → 502", async () => {
    falSubscribe.mockResolvedValue({ data: { images: [] } });
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(502);
  });

  it("generated_images 寫入失敗唔影響結果（best-effort）", async () => {
    fake.failures.add("generated_images");
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect(console.warn).toHaveBeenCalled();
  });
});
