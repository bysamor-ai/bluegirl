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
  /** 租戶有冇獲分配任何品牌底圖（即有冇可用嘅品牌素材） */
  hasBrandAssets: boolean;
  merchantName?: string;
  highlight?: string;
}

/**
 * 牆貼設計稿 prompt。品牌由租戶決定：AI 唔識客戶嘅 logo，
 * 所以冇品牌素材嘅租戶一律明確禁止出 logo／樽／商標，唔好硬塞名。
 */
export function buildStickerPrompt(input: StickerPromptInput): string {
  const { style, tenantName, primaryColor, hasBrandAssets, merchantName, highlight } = input;
  return (
    `Wall decal artwork, to be printed and applied on a restaurant wall. ${style.prompt}. ` +
    `Color palette: ${primaryColor} as the dominant brand color, with white and neutral tones. ` +
    (hasBrandAssets
      ? `Made for the brand "${tenantName}"; keep the look consistent with that brand's color. `
      : "") +
    (merchantName
      ? `Designed for a Hong Kong restaurant called "${merchantName}". `
      : "") +
    (highlight ? `Theme of the promotion: ${highlight}. ` : "") +
    `No brand logos, no bottles, no product marks, no trademarked imagery of any kind. ` +
    `IMPORTANT: no readable text, no lettering, no words, no captions anywhere in the image — ` +
    `leave clear empty areas where text will be added later. ` +
    `Flat front-facing artwork, edge to edge composition, no mockup, no wall, no room, ` +
    `no perspective, no drop shadow, no frame, no border.`
  );
}
