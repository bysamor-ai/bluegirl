import { beforeEach, describe, expect, it, vi } from "vitest";

// 全部用 mock：clients 表開咗 RLS 而冇 policy，anon key 實際查唔到嘢
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn((_columns?: string) => ({ eq }));
const from = vi.fn(() => ({ select }));
const getSupabaseServerClient = vi.fn(() => ({ from }));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => getSupabaseServerClient(),
}));

import { getTenantByToken, normalizeToken, toTenant } from "./resolve";
import type { ClientRow } from "./types";

const row: ClientRow = {
  id: "11111111-1111-1111-1111-111111111111",
  token: "abc123DEF456",
  name: "測試餐廳",
  logo_text: "TEST",
  logo_url: "https://example.com/logo.png",
  primary_color: "#112233",
  backgrounds: ["gold-landscape", "white-portrait"],
  allow_brand_marks: false,
  brand_prompt: null,
  created_at: "2026-11-05T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("normalizeToken", () => {
  it("剪走前後空白", () => expect(normalizeToken("  abc123DEF456 ")).toBe("abc123DEF456"));
  it("空字串回 null", () => expect(normalizeToken("")).toBeNull());
  it("淨係空白回 null", () => expect(normalizeToken("   ")).toBeNull());
  it("含非英數字元回 null", () => expect(normalizeToken("abc/../def")).toBeNull());
  it("長度唔啱回 null", () => expect(normalizeToken("abc")).toBeNull());
  it("太長回 null", () => expect(normalizeToken("abc123DEF4567")).toBeNull());
  it("大小寫照留（token 分大小寫）", () => expect(normalizeToken("AbCdEf123456")).toBe("AbCdEf123456"));
});

describe("toTenant", () => {
  it("snake_case 轉 camelCase", () => {
    expect(toTenant(row)).toEqual({
      id: row.id,
      token: "abc123DEF456",
      name: "測試餐廳",
      logoText: "TEST",
      logoUrl: "https://example.com/logo.png",
      primaryColor: "#112233",
      backgrounds: ["gold-landscape", "white-portrait"],
      allowBrandMarks: false,
      brandPrompt: null,
    });
  });

  it("logo 欄位為 null 時保持 null", () => {
    const t = toTenant({ ...row, logo_text: null, logo_url: null });
    expect(t.logoText).toBeNull();
    expect(t.logoUrl).toBeNull();
  });

  it("過濾走唔存在嘅 background id", () => {
    const t = toTenant({ ...row, backgrounds: ["gold-landscape", "not-a-real-bg"] });
    expect(t.backgrounds).toEqual(["gold-landscape"]);
  });

  it("backgrounds 係 null 時回空陣列", () => {
    const t = toTenant({ ...row, backgrounds: null as unknown as string[] });
    expect(t.backgrounds).toEqual([]);
  });

  it("allow_brand_marks 唔係 true（null／undefined／舊資料列）一律當 false", () => {
    for (const bad of [null, undefined, 0, "true"]) {
      const t = toTenant({ ...row, allow_brand_marks: bad as unknown as boolean });
      expect(t.allowBrandMarks).toBe(false);
    }
    expect(toTenant({ ...row, allow_brand_marks: true }).allowBrandMarks).toBe(true);
  });

  it("brand_prompt 淨係空白當冇設定（null）", () => {
    expect(toTenant({ ...row, brand_prompt: "   " }).brandPrompt).toBeNull();
    expect(toTenant({ ...row, brand_prompt: "  一隻啤酒樽  " }).brandPrompt).toBe("一隻啤酒樽");
  });

  it("有冇海報底圖唔會影響 allowBrandMarks（兩個開關互相獨立）", () => {
    const t = toTenant({ ...row, backgrounds: ["gold-landscape"], allow_brand_marks: false });
    expect(t.backgrounds).toHaveLength(1);
    expect(t.allowBrandMarks).toBe(false);
  });
});

describe("getTenantByToken", () => {
  it("查到就回 Tenant，並用正確條件查詢", async () => {
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    const t = await getTenantByToken(" abc123DEF456 ");
    expect(t?.name).toBe("測試餐廳");
    expect(t?.primaryColor).toBe("#112233");
    expect(from).toHaveBeenCalledWith("clients");
    expect(eq).toHaveBeenCalledWith("token", "abc123DEF456");
    // 新欄位要真係 select 返嚟，否則 allowBrandMarks 永遠係 false
    expect(select.mock.calls[0][0]).toContain("allow_brand_marks");
    expect(select.mock.calls[0][0]).toContain("brand_prompt");
  });

  it("查唔到回 null", async () => {
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect(await getTenantByToken("abc123DEF456")).toBeNull();
  });

  it("token 格式唔啱時唔會打 DB", async () => {
    expect(await getTenantByToken("../etc")).toBeNull();
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("冷啟動 error 會重試", async () => {
    maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST205", message: "Could not find the table in the schema cache" },
      })
      .mockResolvedValueOnce({ data: row, error: null });
    const t = await getTenantByToken("abc123DEF456");
    expect(t?.id).toBe(row.id);
    expect(maybeSingle).toHaveBeenCalledTimes(2);
  });

  it("其他 DB error 會拋錯，唔會當成「查唔到」", async () => {
    maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    await expect(getTenantByToken("abc123DEF456")).rejects.toThrow("租戶查詢失敗");
  });
});
