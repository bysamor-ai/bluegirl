import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mock supabase-js，等測試可以確認傳入 createClient 嘅 key，毋須連真實 DB
const createClientMock = vi.fn((..._args: unknown[]) => ({ __fake: true }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

import { getSupabaseServerClient } from "./server";

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const SERVICE_VAR = "SUPABASE_SERVICE_ROLE_KEY";

describe("getSupabaseServerClient", () => {
  beforeEach(() => {
    createClientMock.mockClear();
    // 先清空相關變數，確保唔依賴真實環境（stubEnv 值為 undefined 即係刪除）
    vi.stubEnv(URL_VAR, undefined);
    vi.stubEnv(ANON_VAR, undefined);
    vi.stubEnv(SERVICE_VAR, undefined);
  });

  afterEach(() => {
    // 還原 process.env 至測試前狀態，避免污染其他測試檔
    vi.unstubAllEnvs();
  });

  it("冇 SUPABASE_SERVICE_ROLE_KEY 就拋明確錯誤（講明變數名同只限伺服器）", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    expect(() => getSupabaseServerClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(() => getSupabaseServerClient()).toThrow(/只限伺服器/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("唔會靜靜降級用 anon key", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    vi.stubEnv(ANON_VAR, "anon-key-should-not-be-used");
    expect(() => getSupabaseServerClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("service role key 係空字串都當冇設定", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    vi.stubEnv(SERVICE_VAR, "");
    expect(() => getSupabaseServerClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("冇 NEXT_PUBLIC_SUPABASE_URL 就拋錯", () => {
    vi.stubEnv(SERVICE_VAR, "service-key");
    expect(() => getSupabaseServerClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("齊變數時建到 client，並且用 service role key（唔係 anon）", () => {
    vi.stubEnv(URL_VAR, "https://example.supabase.co");
    vi.stubEnv(ANON_VAR, "anon-key");
    vi.stubEnv(SERVICE_VAR, "service-key");

    const client = getSupabaseServerClient();

    expect(client).toBeTruthy();
    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createClientMock.mock.calls[0] as [string, string, { auth: { persistSession: boolean } }];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("service-key");
    expect(options.auth.persistSession).toBe(false);
  });
});
