import { describe, expect, it } from "vitest";
import {
  RATE_PER_SQM,
  calculateQuote,
  formatArea,
  formatHkd,
  toMetres,
} from "./pricing";

describe("toMetres", () => {
  it("米原封不動", () => {
    expect(toMetres(1.2, "m")).toBe(1.2);
  });

  it("厘米換算成米", () => {
    expect(toMetres(120, "cm")).toBeCloseTo(1.2, 10);
  });

  it("負數 / NaN / Infinity 當 0", () => {
    expect(toMetres(-5, "m")).toBe(0);
    expect(toMetres(Number.NaN, "cm")).toBe(0);
    expect(toMetres(Number.POSITIVE_INFINITY, "m")).toBe(0);
  });
});

describe("calculateQuote", () => {
  it("1.2m × 1.0m = 1.2 m² = HK$1,200", () => {
    const q = calculateQuote(1.2, 1.0);
    expect(q.areaSqm).toBeCloseTo(1.2, 10);
    expect(q.priceHkd).toBe(1200);
  });

  it("用 rate 常數，唔係寫死 1000", () => {
    expect(calculateQuote(1, 1).priceHkd).toBe(RATE_PER_SQM);
  });

  it("厘米輸入得出同樣結果", () => {
    expect(calculateQuote(120, 100, "cm").priceHkd).toBe(1200);
  });

  it("四捨五入到最接近嘅 $1（.5 向上）", () => {
    // 0.0015 m² × 1000 = 1.5 → 2
    expect(calculateQuote(0.03, 0.05).priceHkd).toBe(2);
    // 0.0014 m² × 1000 = 1.4 → 1
    expect(calculateQuote(0.02, 0.07).priceHkd).toBe(1);
  });

  it("尺寸 0 或負數 → 面積同價錢都係 0", () => {
    expect(calculateQuote(0, 2).priceHkd).toBe(0);
    expect(calculateQuote(-3, 2).areaSqm).toBe(0);
    expect(calculateQuote(Number.NaN, 2).priceHkd).toBe(0);
  });

  it("大尺寸唔會失準", () => {
    expect(calculateQuote(10, 4.5).priceHkd).toBe(45000);
  });
});

describe("格式化", () => {
  it("金額有千位符號、冇小數", () => {
    expect(formatHkd(1200)).toBe("HK$1,200");
    expect(formatHkd(0)).toBe("HK$0");
  });

  it("面積固定兩位小數", () => {
    expect(formatArea(1.2)).toBe("1.20 m²");
    expect(formatArea(-1)).toBe("0.00 m²");
  });
});
