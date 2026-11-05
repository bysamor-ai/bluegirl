import { describe, expect, it } from "vitest";
import { buildStickerPrompt, STICKER_STYLES } from "./stickerStyles";

const base = {
  style: STICKER_STYLES[0],
  tenantName: "貳號冰室",
  primaryColor: "#aa3300",
  merchantName: "某餐廳",
};

const BAN = "No brand logos, no bottles, no product marks";

describe("buildStickerPrompt — 白牌租戶（allowBrandMarks = false，預設）", () => {
  it("明確禁止 logo／樽／商標，並用租戶主色", () => {
    const p = buildStickerPrompt({ ...base, allowBrandMarks: false });
    expect(p).toContain(BAN);
    expect(p).toContain("#aa3300");
  });

  it("prompt 唔帶租戶名（AI 唔識客戶 logo，硬塞個名只會出錯嘅品牌）", () => {
    const p = buildStickerPrompt({ ...base, allowBrandMarks: false });
    expect(p).not.toContain("貳號冰室");
  });

  it("成張圖一個字都唔好出", () => {
    const p = buildStickerPrompt({ ...base, allowBrandMarks: false });
    expect(p).toContain("IMPORTANT: no readable text, no lettering, no words");
    expect(p).not.toContain("apart from the brand");
  });

  it("就算 brandPrompt 有值都唔會拼落去（開關係 allowBrandMarks）", () => {
    const p = buildStickerPrompt({
      ...base,
      allowBrandMarks: false,
      brandPrompt: "a BLUE GIRL beer bottle",
    });
    expect(p).toContain(BAN);
    expect(p).not.toContain("BLUE GIRL");
    expect(p).not.toContain("Brand elements to feature");
  });

  it("所有風格同 prompt 都冇寫死舊品牌、啤酒或固定配色", () => {
    for (const style of STICKER_STYLES) {
      const p = buildStickerPrompt({ ...base, style, allowBrandMarks: false });
      expect(p).not.toMatch(/blue ?girl|beer|navy|藍妹/i);
      expect(p).not.toMatch(/#12204a|#c9a24b/i);
    }
  });
});

describe("buildStickerPrompt — 有品牌嘅租戶（allowBrandMarks = true）", () => {
  const branded = {
    ...base,
    allowBrandMarks: true,
    brandPrompt: "a BLUE GIRL beer bottle, navy and gold brand palette",
  };

  it("唔會拼禁令，改為拼 brandPrompt 嘅自由文字", () => {
    const p = buildStickerPrompt(branded);
    expect(p).not.toContain(BAN);
    expect(p).toContain("Brand elements to feature: a BLUE GIRL beer bottle, navy and gold brand palette");
    expect(p).toContain('Made for the brand "貳號冰室"');
  });

  it("文字處理理順：只排除品牌 logo／wordmark 以外嘅文字，唔再自相矛盾", () => {
    const p = buildStickerPrompt(branded);
    expect(p).toContain("apart from the brand's own logo or wordmark, no readable text");
    // 唔可以同時出現「出品牌標誌」同無條件嘅「一個字都唔好出」
    expect(p).not.toContain("IMPORTANT: no readable text");
  });

  it("brandPrompt 冇設定（null／空白）時唔會拼空描述，但仍然唔加禁令", () => {
    for (const brandPrompt of [null, undefined, "   "]) {
      const p = buildStickerPrompt({ ...branded, brandPrompt });
      expect(p).not.toContain("Brand elements to feature");
      expect(p).not.toContain(BAN);
      expect(p).toContain('Made for the brand "貳號冰室"');
    }
  });
});
