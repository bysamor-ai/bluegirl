/**
 * 牆貼生產報價 — 純函數，方便測試同日後改 rate。
 */

/** 每平方米生產價（HKD）。日後改價只需要改呢一處。 */
export const RATE_PER_SQM = 1000;

/** 支援嘅長度單位 */
export type LengthUnit = "m" | "cm";

export interface Quote {
  /** 闊（米） */
  widthM: number;
  /** 高（米） */
  heightM: number;
  /** 面積（平方米） */
  areaSqm: number;
  /** 生產價（港幣，已四捨五入到 $1） */
  priceHkd: number;
}

/** 將任何輸入化為 >= 0 嘅有限數字；NaN / 負數 / Infinity 一律當 0。 */
function sanitize(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

/** 將長度換算成米。 */
export function toMetres(value: number, unit: LengthUnit): number {
  const v = sanitize(value);
  return unit === "cm" ? v / 100 : v;
}

/**
 * 計報價：面積 × RATE_PER_SQM，四捨五入到最接近嘅 HK$1。
 * 闊高以指定單位輸入（預設米）。
 */
export function calculateQuote(
  width: number,
  height: number,
  unit: LengthUnit = "m"
): Quote {
  const widthM = toMetres(width, unit);
  const heightM = toMetres(height, unit);
  const areaSqm = widthM * heightM;
  return {
    widthM,
    heightM,
    areaSqm,
    priceHkd: Math.round(areaSqm * RATE_PER_SQM),
  };
}

const HKD = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  maximumFractionDigits: 0,
});

/** 格式化港幣金額，例如 1200 → "HK$1,200"。 */
export function formatHkd(amount: number): string {
  return HKD.format(Number.isFinite(amount) ? amount : 0);
}

/** 格式化面積，例如 1.2 → "1.20 m²"。 */
export function formatArea(areaSqm: number): string {
  const safe = Number.isFinite(areaSqm) && areaSqm > 0 ? areaSqm : 0;
  return `${safe.toFixed(2)} m²`;
}
