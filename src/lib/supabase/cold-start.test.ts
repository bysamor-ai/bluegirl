import { describe, expect, it, vi } from "vitest";
import {
  COLD_START_CODE,
  isColdStartError,
  retryOnColdStart,
  type QueryResult,
} from "./cold-start";

describe("isColdStartError", () => {
  it("認得 PGRST205 code", () => {
    expect(isColdStartError({ code: COLD_START_CODE, message: "whatever" })).toBe(true);
  });

  it("認得 schema cache 字眼（就算冇 code）", () => {
    expect(
      isColdStartError({
        message: "Could not find the table 'public.restaurants' in the schema cache",
      })
    ).toBe(true);
  });

  it("唔會當真・設定錯誤係冷啟動", () => {
    expect(isColdStartError({ code: "42P01", message: 'relation "restaurants" does not exist' })).toBe(false);
    expect(isColdStartError({ code: "PGRST301", message: "JWT expired" })).toBe(false);
  });

  it("冇 error 就唔係冷啟動", () => {
    expect(isColdStartError(null)).toBe(false);
    expect(isColdStartError(undefined)).toBe(false);
  });
});

describe("retryOnColdStart", () => {
  const coldError = { code: COLD_START_CODE, message: "schema cache" };
  const noSleep = async () => {};

  it("一次就成功就唔會重試", async () => {
    const run = vi.fn(async (): Promise<QueryResult<string[]>> => ({ data: ["a"], error: null }));
    const result = await retryOnColdStart(run, { sleep: noSleep });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual(["a"]);
  });

  it("冷啟動 error 會重試，暖好之後攞到資料", async () => {
    const run = vi
      .fn<() => Promise<QueryResult<string[]>>>()
      .mockResolvedValueOnce({ data: null, error: coldError })
      .mockResolvedValueOnce({ data: ["a"], error: null });
    const result = await retryOnColdStart(run, { sleep: noSleep });
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
    expect(result.data).toEqual(["a"]);
  });

  it("試夠次數都仲係凍就回最後嗰個 error", async () => {
    const run = vi.fn(async (): Promise<QueryResult<string[]>> => ({ data: null, error: coldError }));
    const result = await retryOnColdStart(run, { attempts: 3, sleep: noSleep });
    expect(run).toHaveBeenCalledTimes(3);
    expect(result.error).toEqual(coldError);
  });

  it("其他 error 即刻回，唔會白等", async () => {
    const realError = { code: "42P01", message: 'relation "restaurants" does not exist' };
    const run = vi.fn(async (): Promise<QueryResult<string[]>> => ({ data: null, error: realError }));
    const result = await retryOnColdStart(run, { attempts: 3, sleep: noSleep });
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.error).toEqual(realError);
  });

  it("等待時間遞增（800ms、1600ms）", async () => {
    const waits: number[] = [];
    const run = vi.fn(async (): Promise<QueryResult<string[]>> => ({ data: null, error: coldError }));
    await retryOnColdStart(run, {
      attempts: 3,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits).toEqual([800, 1600]);
  });
});
