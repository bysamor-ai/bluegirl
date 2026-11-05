import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { createFakeDb } from "@/test-utils/fake-db";

const fake = createFakeDb();
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: () => fake.client }));

const fal = vi.hoisted(() => ({ subscribe: vi.fn(), upload: vi.fn() }));
vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: fal.subscribe, storage: { upload: fal.upload } },
}));

const getTenantByToken = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({ getTenantByToken: (t: string) => getTenantByToken(t) }));

import { POST } from "./route";

const A = { id: "tenant-a", token: "aaaaaaaaaaaa", backgrounds: ["gold-portrait", "white-portrait"] };
const B = { id: "tenant-b", token: "bbbbbbbbbbbb", backgrounds: ["gold-landscape"] };
const R_A = "11111111-1111-4111-8111-111111111111";
const R_B = "22222222-2222-4222-8222-222222222222";

const ctx = (params: unknown) => ({ params: Promise.resolve(params) }) as never;
const req = (body?: unknown, bad = false) =>
  ({
    url: "http://localhost/api/t/x/generate-poster",
    json: async () => {
      if (bad) throw new SyntaxError("bad json");
      return body;
    },
  }) as unknown as NextRequest;

const base = {
  restaurantName: "新店",
  backgroundId: "gold-portrait",
  items: [{ name: "叉燒飯", price: 50 }],
};
const inserts = () => fake.calls.filter((c) => c.table === "generated_images" && c.op === "insert");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.FAL_KEY = "test-fal-key";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  );
  fake.reset();
  fake.db.restaurants = [
    { id: R_A, client_id: A.id },
    { id: R_B, client_id: B.id },
  ];
  getTenantByToken.mockImplementation(async (t: string) =>
    t === A.token ? A : t === B.token ? B : null
  );
  fal.upload.mockResolvedValue("https://fal.media/up.jpg");
  fal.subscribe.mockResolvedValue({ data: { images: [{ url: "https://fal.media/poster.png" }] } });
});

describe("token / 請求驗證", () => {
  it("token 查唔到 → 404", async () => {
    const res = await POST(req(base), ctx({ token: "zzzzzzzzzzzz" }));
    expect(res.status).toBe(404);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });

  it("租戶查詢 DB 故障 → 500，唔洩露", async () => {
    getTenantByToken.mockRejectedValue(new Error("SECRET_DB_DETAIL"));
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
  });

  it("JSON 壞 → 400", async () => {
    expect((await POST(req(undefined, true), ctx({ token: A.token }))).status).toBe(400);
  });

  it("schema 唔過 → 400，唔叫 fal", async () => {
    const res = await POST(req({ ...base, items: [] }), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });
});

describe("租戶擁有權驗證", () => {
  it("restaurantId 屬於本租戶 → 成功並寫入", async () => {
    const res = await POST(req({ ...base, restaurantId: R_A }), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect((await res.json()).imageUrl).toBe("https://fal.media/poster.png");
    expect(inserts()[0].payload).toMatchObject({ restaurant_id: R_A, menu_item_id: null });
    const q = fake.calls.find((c) => c.table === "restaurants");
    expect(q?.filters).toEqual(expect.arrayContaining([["id", R_A], ["client_id", A.id]]));
  });

  it("restaurantId 屬於其他租戶 → 404，唔叫 fal，唔寫入", async () => {
    const res = await POST(req({ ...base, restaurantId: R_B }), ctx({ token: A.token }));
    expect(res.status).toBe(404);
    expect(fal.subscribe).not.toHaveBeenCalled();
    expect(fal.upload).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it("冇 restaurantId → 成功，restaurant_id 為 null，唔查 restaurants", async () => {
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect(fake.calls.filter((c) => c.table === "restaurants")).toHaveLength(0);
    expect(inserts()[0].payload).toMatchObject({ restaurant_id: null });
  });

  it("擁有權查詢 DB 故障 → 500，唔係 404", async () => {
    fake.failures.add("restaurants");
    const res = await POST(req({ ...base, restaurantId: R_A }), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(fal.subscribe).not.toHaveBeenCalled();
  });
});

describe("fal.ai", () => {
  it("冇 FAL_KEY → 500，唔洩露變數名", async () => {
    delete process.env.FAL_KEY;
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("FAL_KEY");
  });

  it("fal 拋錯 → 502 通用訊息", async () => {
    fal.subscribe.mockRejectedValue(new Error("SECRET_FAL_DETAIL"));
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(console.error).toHaveBeenCalled();
  });

  it("讀取背景圖失敗 → 502，唔洩露", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const res = await POST(req(base), ctx({ token: A.token }));
    expect(res.status).toBe(502);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("background");
    expect(text).not.toContain("/backgrounds/");
    expect(text).not.toContain("500");
    expect(console.error).toHaveBeenCalled();
  });

  it("fal 冇回圖 → 502", async () => {
    fal.subscribe.mockResolvedValue({ data: {} });
    expect((await POST(req(base), ctx({ token: A.token }))).status).toBe(502);
  });

  it("generated_images 寫入失敗唔影響結果", async () => {
    fake.failures.add("generated_images");
    expect((await POST(req(base), ctx({ token: A.token }))).status).toBe(200);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe("背景白名單", () => {
  it("backgroundId 唔喺本租戶 backgrounds → 404，唔叫 fal，唔查 DB，唔寫入", async () => {
    // gold-landscape 屬於租戶 B，A 唔可以用
    const res = await POST(req({ ...base, backgroundId: "gold-landscape" }), ctx({ token: A.token }));
    expect(res.status).toBe(404);
    expect(fal.subscribe).not.toHaveBeenCalled();
    expect(fal.upload).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it("同一個背景對 B 可用、對 A 唔可用", async () => {
    const body = { ...base, backgroundId: "gold-landscape" };
    expect((await POST(req(body), ctx({ token: B.token }))).status).toBe(200);
    expect((await POST(req(body), ctx({ token: A.token }))).status).toBe(404);
  });

  it("白名單內嘅背景 → 成功", async () => {
    const res = await POST(req({ ...base, backgroundId: "white-portrait" }), ctx({ token: A.token }));
    expect(res.status).toBe(200);
  });
});
