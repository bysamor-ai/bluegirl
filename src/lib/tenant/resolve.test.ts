import { beforeEach, describe, expect, it, vi } from "vitest";

// 全部用 mock：clients 表開咗 RLS 而冇 policy，anon key 實際查唔到嘢
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
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
});

describe("getTenantByToken", () => {
  it("查到就回 Tenant，並用正確條件查詢", async () => {
    maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    const t = await getTenantByToken(" abc123DEF456 ");
    expect(t?.name).toBe("測試餐廳");
    expect(t?.primaryColor).toBe("#112233");
    expect(from).toHaveBeenCalledWith("clients");
    expect(eq).toHaveBeenCalledWith("token", "abc123DEF456");
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
