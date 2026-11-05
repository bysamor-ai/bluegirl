import { beforeEach, describe, expect, it, vi } from "vitest";

// notFound() 喺 Next.js 入面會拋一個特製 error；測試用一個認得出嘅替身
class NotFoundError extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
const notFound = vi.fn(() => {
  throw new NotFoundError();
});
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

const getTenantByToken = vi.fn();
vi.mock("./resolve", () => ({
  getTenantByToken: (raw: string) => getTenantByToken(raw),
}));

import { getTenantFromParams, type TenantRouteParams } from "./params";
import type { Tenant } from "./types";

const tenant: Tenant = {
  id: "11111111-1111-1111-1111-111111111111",
  token: "abc123DEF456",
  name: "測試餐廳",
  logoText: "TEST",
  logoUrl: null,
  primaryColor: "#112233",
  backgrounds: ["gold-landscape"],
};

/** 模擬 runtime 真實情況：params 嘅型別未必同宣告一致 */
function paramsOf(token: unknown): Promise<TenantRouteParams> {
  return Promise.resolve({ token } as TenantRouteParams);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTenantFromParams", () => {
  it("查到租戶就回 Tenant", async () => {
    getTenantByToken.mockResolvedValueOnce(tenant);
    await expect(getTenantFromParams(paramsOf("abc123DEF456"))).resolves.toEqual(tenant);
    expect(getTenantByToken).toHaveBeenCalledWith("abc123DEF456");
  });

  it("查唔到租戶就 notFound()", async () => {
    getTenantByToken.mockResolvedValueOnce(null);
    await expect(getTenantFromParams(paramsOf("zzzzzzzzzzzz"))).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(notFound).toHaveBeenCalled();
  });

  it("token 係 string[] 時唔會打 getTenantByToken，直接 notFound()", async () => {
    await expect(getTenantFromParams(paramsOf(["a", "b"]))).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(getTenantByToken).not.toHaveBeenCalled();
  });

  it("token 係 undefined 時唔會打 getTenantByToken，直接 notFound()", async () => {
    await expect(getTenantFromParams(paramsOf(undefined))).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(getTenantByToken).not.toHaveBeenCalled();
  });

  // 空字串係 string，所以會行落 getTenantByToken，由 normalizeToken 回 null → notFound()。
  // 分別喺於：唔係 string 嗰啲根本唔會打 getTenantByToken。
  it("token 係空字串時回 null → notFound()", async () => {
    getTenantByToken.mockResolvedValueOnce(null);
    await expect(getTenantFromParams(paramsOf(""))).rejects.toBeInstanceOf(NotFoundError);
    expect(getTenantByToken).toHaveBeenCalledWith("");
    expect(notFound).toHaveBeenCalled();
  });

  it("token 淨係空白時回 null → notFound()", async () => {
    getTenantByToken.mockResolvedValueOnce(null);
    await expect(getTenantFromParams(paramsOf("   "))).rejects.toBeInstanceOf(NotFoundError);
    expect(getTenantByToken).toHaveBeenCalledWith("   ");
    expect(notFound).toHaveBeenCalled();
  });

  it("資料庫故障嘅例外要原樣拋出，唔可以變成 notFound()", async () => {
    getTenantByToken.mockRejectedValueOnce(new Error("租戶查詢失敗：connection reset"));
    await expect(getTenantFromParams(paramsOf("abc123DEF456"))).rejects.toThrow(
      "租戶查詢失敗"
    );
    expect(notFound).not.toHaveBeenCalled();
  });
});
