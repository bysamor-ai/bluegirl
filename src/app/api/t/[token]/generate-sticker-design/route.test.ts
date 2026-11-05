import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const fal = vi.hoisted(() => ({ subscribe: vi.fn(), upload: vi.fn() }));
vi.mock("@fal-ai/client", () => ({
  fal: { config: vi.fn(), subscribe: fal.subscribe, storage: { upload: fal.upload } },
}));

const getTenantByToken = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({ getTenantByToken: (t: string) => getTenantByToken(t) }));

// 呢條 route 唔掂資料庫；若果有人日後加咗 DB 存取，呢個 mock 會令測試即刻爆
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => {
    throw new Error("generate-sticker-design 唔應該存取資料庫");
  },
}));

import { POST } from "./route";

const A = { id: "tenant-a", token: "aaaaaaaaaaaa" };
const ctx = (params: unknown) => ({ params: Promise.resolve(params) }) as never;
const req = (body?: unknown, bad = false) =>
  ({
    json: async () => {
      if (bad) throw new SyntaxError("bad json");
      return body;
    },
  }) as unknown as NextRequest;

const ok = { merchantName: "新店", highlight: "開業", style: "classic", aspectRatio: 1.5 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.FAL_KEY = "test-fal-key";
  getTenantByToken.mockImplementation(async (t: string) => (t === A.token ? A : null));
  fal.upload.mockResolvedValue("https://fal.media/up.jpg");
  fal.subscribe.mockResolvedValue({ data: { images: [{ url: "https://fal.media/out.png" }] } });
});

describe("POST /api/t/[token]/generate-sticker-design", () => {
  it("成功回 imageUrl", async () => {
    const res = await POST(req(ok), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    expect((await res.json()).imageUrl).toBe("https://fal.media/out.png");
  });

  it("token 查唔到 → 404，唔叫 fal", async () => {
    const res = await POST(req(ok), ctx({ token: "zzzzzzzzzzzz" }));
    expect(res.status).toBe(404);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });

  it("token 非 string → 404", async () => {
    expect((await POST(req(ok), ctx({ token: undefined }))).status).toBe(404);
  });

  it("租戶查詢 DB 故障 → 500，唔係 404，唔洩露", async () => {
    getTenantByToken.mockRejectedValue(new Error("SECRET_DB_DETAIL"));
    const res = await POST(req(ok), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
  });

  it("JSON 壞 → 400", async () => {
    expect((await POST(req(undefined, true), ctx({ token: A.token }))).status).toBe(400);
  });

  it("schema 唔過（aspectRatio 負數）→ 400 固定訊息，唔叫 fal", async () => {
    const res = await POST(req({ aspectRatio: -1 }), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect(fal.subscribe).not.toHaveBeenCalled();
  });

  it("冇 FAL_KEY → 500，唔洩露變數名", async () => {
    delete process.env.FAL_KEY;
    const res = await POST(req(ok), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("FAL_KEY");
  });

  it("fal 拋錯 → 502 通用訊息，詳情只入 console.error", async () => {
    fal.subscribe.mockRejectedValue(new Error("SECRET_FAL_DETAIL"));
    const res = await POST(req(ok), ctx({ token: A.token }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(console.error).toHaveBeenCalled();
  });

  it("fal 冇回圖 → 502", async () => {
    fal.subscribe.mockResolvedValue({ data: {} });
    expect((await POST(req(ok), ctx({ token: A.token }))).status).toBe(502);
  });
});
