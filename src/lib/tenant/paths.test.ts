import { describe, expect, it } from "vitest";
import {
  tenantBasePath,
  tenantEditorPath,
  tenantMenuPath,
  tenantNewEditorPath,
  tenantRestaurantApiPath,
  tenantRestaurantsApiPath,
  tenantWallStickerPath,
} from "./paths";

// 呢個模組冇任何 import（特別係冇 server-only），所以 client component 都用得。
// 測試鎖住 URL schema：改咗呢度就等於改咗全站連結，一定要係有意識嘅決定。

const token = "abc123DEF456";
const id = "11111111-1111-1111-1111-111111111111";

describe("租戶 URL schema", () => {
  it("tenantBasePath", () => {
    expect(tenantBasePath(token)).toBe("/t/abc123DEF456");
  });

  it("tenantNewEditorPath", () => {
    expect(tenantNewEditorPath(token)).toBe("/t/abc123DEF456/editor");
  });

  it("tenantEditorPath", () => {
    expect(tenantEditorPath(token, id)).toBe(`/t/abc123DEF456/editor/${id}`);
  });

  it("tenantMenuPath", () => {
    expect(tenantMenuPath(token, id)).toBe(`/t/abc123DEF456/menu/${id}`);
  });

  it("tenantWallStickerPath", () => {
    expect(tenantWallStickerPath(token)).toBe("/t/abc123DEF456/wall-sticker");
  });
});

describe("token 編碼", () => {
  it("特殊字元會被編碼，唔會走出路徑段", () => {
    expect(tenantBasePath("a/b")).toBe("/t/a%2Fb");
    expect(tenantNewEditorPath("../x")).toBe("/t/..%2Fx/editor");
  });

  // 空 token 實際上去唔到呢度（頁面會先 notFound()），
  // 記錄返行為係想講明：呢啲 helper 唔負責驗證，驗證喺 getTenantFromParams。
  it("空 token 照砌（唔做驗證）", () => {
    expect(tenantBasePath("")).toBe("/t/");
    expect(tenantNewEditorPath("")).toBe("/t//editor");
  });
});

describe("API 路徑", () => {
  it("餐廳 API 路徑", () => {
    expect(tenantRestaurantsApiPath("abc123DEF456")).toBe("/api/t/abc123DEF456/restaurants");
    expect(tenantRestaurantApiPath("abc123DEF456", "r1")).toBe("/api/t/abc123DEF456/restaurants/r1");
  });
  it("特殊字元會被編碼", () => {
    expect(tenantRestaurantsApiPath("a/b")).toBe("/api/t/a%2Fb/restaurants");
    expect(tenantRestaurantApiPath("t", "../x")).toBe("/api/t/t/restaurants/..%2Fx");
  });
});
