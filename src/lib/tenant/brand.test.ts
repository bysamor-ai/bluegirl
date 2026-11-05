import { describe, expect, it } from "vitest";
import { brandMark, DEFAULT_BRAND_COLOR, safeBrandColor } from "./brand";

describe("safeBrandColor", () => {
  it("接受 #rgb 同 #rrggbb", () => {
    expect(safeBrandColor("#abc")).toBe("#abc");
    expect(safeBrandColor("#1E2A63")).toBe("#1E2A63");
  });
  it("拒絕非法值並回預設", () => {
    for (const bad of ["red", "#12", "#12345g", "red;background:url(x)", "", null, undefined]) {
      expect(safeBrandColor(bad)).toBe(DEFAULT_BRAND_COLOR);
    }
  });
});

describe("brandMark", () => {
  it("有 logoText 用 logoText", () => {
    expect(brandMark({ logoText: " 貳號 ", name: "貳號冰室" })).toBe("貳號");
  });
  it("冇 logoText 用名稱頭兩個字（支援中文同 emoji）", () => {
    expect(brandMark({ logoText: null, name: "貳號冰室" })).toBe("貳號");
    expect(brandMark({ logoText: "  ", name: "Cafe X" })).toBe("Ca");
    expect(brandMark({ logoText: null, name: "A" })).toBe("A");
  });
});
