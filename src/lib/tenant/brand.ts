/**
 * 白牌品牌嘅純函數（零 import，server／client／test 都用得）。
 */

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** 中性預設主色（資料庫值唔合法時用） */
export const DEFAULT_BRAND_COLOR = "#2563eb";

/**
 * 主色會被寫入 inline style 嘅 CSS 變數，所以一定要先驗證，
 * 唔好信任資料庫值（避免 CSS 注入）。只接受 #rgb／#rrggbb。
 */
export function safeBrandColor(color: string | null | undefined): string {
  const c = (color ?? "").trim();
  return HEX_COLOR.test(c) ? c : DEFAULT_BRAND_COLOR;
}

/** 冇 logo 圖亦冇 logo 文字時，用租戶名稱頭兩個字做文字 logo */
export function brandMark(brand: {
  logoText: string | null;
  name: string;
}): string {
  const text = brand.logoText?.trim();
  if (text) return text;
  return Array.from(brand.name.trim()).slice(0, 2).join("");
}
