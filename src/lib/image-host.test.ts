import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canOptimizeImage, __resetWarnedForTests } from "./image-host";

const SB = "https://abc.supabase.co";

describe("canOptimizeImage", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SB);
    __resetWarnedForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each([
    [`${SB}/storage/v1/object/public/food-images/t/a.png`, true],
    [`${SB}/storage/v1/object/sign/food-images/t/a.png?token=x`, false],
    [`${SB}/rest/v1/foo`, false],
    ["https://other.supabase.co/storage/v1/object/public/x/a.png", false],
    ["https://fal.media/files/a.png", true],
    ["https://v3.fal.media/files/a.png", true],
    ["https://evilfal.media/a.png", false],
    ["https://fal.media.evil.com/a.png", false],
    ["data:image/png;base64,AAAA", false],
    ["blob:https://x.test/uuid", false],
    ["http://fal.media/a.png", false],
    ["//fal.media/a.png", false],
    ["/backgrounds/gold-portrait.jpg", true],
    ["not a url", false],
  ])("%s -> %s", (src, expected) => {
    expect(canOptimizeImage(src)).toBe(expected);
  });

  it("env 缺失：Supabase 圖唔優化，並只 warn 一次", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const u = `${SB}/storage/v1/object/public/a/b.png`;
    expect(canOptimizeImage(u)).toBe(false);
    expect(canOptimizeImage(u)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(canOptimizeImage("https://fal.media/a.png")).toBe(true);
  });
});
