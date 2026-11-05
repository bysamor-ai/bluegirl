import { describe, expect, it } from "vitest";
import { buildStickerPrompt, STICKER_STYLES } from "./stickerStyles";

const base = {
  style: STICKER_STYLES[0],
  tenantName: "貳號冰室",
  primaryColor: "#aa3300",
  merchantName: "某餐廳",
};

describe("buildStickerPrompt", () => {
  it("任何租戶都明確禁止 logo／樽／商標，並用租戶主色", () => {
    for (const hasBrandAssets of [true, false]) {
      const p = buildStickerPrompt({ ...base, hasBrandAssets });
      expect(p).toContain("No brand logos, no bottles, no product marks");
      expect(p).toContain("#aa3300");
    }
  });

  it("冇品牌素材嘅租戶 prompt 唔帶租戶名", () => {
    const p = buildStickerPrompt({ ...base, hasBrandAssets: false });
    expect(p).not.toContain("貳號冰室");
  });

  it("所有風格同 prompt 都冇寫死舊品牌、啤酒或固定配色", () => {
    for (const style of STICKER_STYLES) {
      const p = buildStickerPrompt({ ...base, style, hasBrandAssets: false });
      expect(p).not.toMatch(/blue ?girl|beer|navy|藍妹/i);
      expect(p).not.toMatch(/#12204a|#c9a24b/i);
    }
  });
});
