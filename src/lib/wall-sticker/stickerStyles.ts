/**
 * 牆貼設計風格 — 每個風格對應一段英文 prompt（英文 prompt 出圖較穩定）。
 * 風格只描述版面同質感，唔寫死任何品牌或顏色；主色由租戶 primaryColor 決定（見 buildStickerPrompt）。
 */

export const STICKER_STYLES = [
  {
    id: "classic",
    label: "經典冰室",
    prompt:
      "nostalgic Hong Kong cha chaan teng poster aesthetic, " +
      "brush-stroke calligraphy feel, warm cream background, subtle paper texture",
  },
  {
    id: "modern",
    label: "簡約現代",
    prompt:
      "clean modern poster, solid brand-color field with crisp accents, " +
      "generous white space, minimal geometric shapes",
  },
  {
    id: "promo",
    label: "大膽促銷",
    prompt:
      "bold high-impact promotional poster, strong color contrast, " +
      "large graphic burst shapes, energetic layout, eye-catching from across the street",
  },
  {
    id: "festive",
    label: "節慶金裝",
    prompt:
      "festive celebratory poster, rich metallic foil textures, " +
      "ornamental borders, warm celebratory glow, premium gift-season feel",
  },
] as const;

export type StickerStyle = (typeof STICKER_STYLES)[number];
export type StickerStyleId = StickerStyle["id"];

export function getStickerStyle(id: string): StickerStyle {
  return STICKER_STYLES.find((s) => s.id === id) ?? STICKER_STYLES[0];
}

/**
 * 由貼位長寬比揀最接近嘅 fal.ai image_size。
 * 貼牆通常係橫向或者接近正方，所以只需要幾個選項。
 */
export function pickImageSize(
  aspectRatio: number
): "landscape_16_9" | "landscape_4_3" | "square_hd" | "portrait_4_3" | "portrait_16_9" {
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return "landscape_4_3";
  if (aspectRatio >= 1.6) return "landscape_16_9";
  if (aspectRatio >= 1.15) return "landscape_4_3";
  if (aspectRatio >= 0.87) return "square_hd";
  if (aspectRatio >= 0.62) return "portrait_4_3";
  return "portrait_16_9";
}

export interface StickerPromptInput {
  style: { prompt: string };
  tenantName: string;
  /** 已驗證嘅 #hex（safeBrandColor 輸出） */
  primaryColor: string;
  /**
   * 租戶可唔可以出品牌標誌（由 `clients.allow_brand_marks` 決定，預設 false）。
   * 刻意唔用「有冇海報底圖」推導：兩者係兩件唔同嘅事。
   */
  allowBrandMarks: boolean;
  /** allowBrandMarks 為 true 時拼落 prompt 嘅品牌描述（`clients.brand_prompt`） */
  brandPrompt?: string | null;
  merchantName?: string;
  highlight?: string;
}

/**
 * 牆貼設計稿 prompt。
 *
 * - `allowBrandMarks = false`（預設，所有白牌租戶）：明確禁止出 logo／樽／商標，
 *   亦唔會提租戶名 —— AI 唔識客戶嘅 logo，硬塞個名只會產生錯嘅品牌。
 * - `allowBrandMarks = true`：唔拼嗰句禁令，改為拼 `brandPrompt` 嘅自由文字。
 *
 * 文字處理分兩種：白牌一律「成張圖一個字都唔好出」；有品牌嗰邊，
 * 品牌自己嘅 logo／wordmark 本身就係圖形，所以只排除其他文字，
 * 唔好再同「出品牌標誌」自相矛盾。中文字兩種情況都係前端疊上去。
 */
export function buildStickerPrompt(input: StickerPromptInput): string {
  const {
    style,
    tenantName,
    primaryColor,
    allowBrandMarks,
    brandPrompt,
    merchantName,
    highlight,
  } = input;
  const brand = brandPrompt?.trim();

  return (
    `Wall decal artwork, to be printed and applied on a restaurant wall. ${style.prompt}. ` +
    `Color palette: ${primaryColor} as the dominant brand color, with white and neutral tones. ` +
    (allowBrandMarks
      ? `Made for the brand "${tenantName}"; keep the look consistent with that brand's color. ` +
        (brand ? `Brand elements to feature: ${brand}. ` : "")
      : "") +
    (merchantName
      ? `Designed for a Hong Kong restaurant called "${merchantName}". `
      : "") +
    (highlight ? `Theme of the promotion: ${highlight}. ` : "") +
    (allowBrandMarks
      ? `IMPORTANT: apart from the brand's own logo or wordmark, no readable text, ` +
        `no lettering, no words, no captions anywhere in the image — ` +
        `leave clear empty areas where text will be added later. `
      : `No brand logos, no bottles, no product marks, no trademarked imagery of any kind. ` +
        `IMPORTANT: no readable text, no lettering, no words, no captions anywhere in the image — ` +
        `leave clear empty areas where text will be added later. `) +
    `Flat front-facing artwork, edge to edge composition, no mockup, no wall, no room, ` +
    `no perspective, no drop shadow, no frame, no border.`
  );
}
