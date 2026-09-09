/**
 * 牆貼設計風格 — 每個風格對應一段英文 prompt（英文 prompt 出圖較穩定）。
 * 所有風格都圍繞 BLUE GIRL 品牌：深寶藍 + 金色 + 白色。
 */

export const STICKER_STYLES = [
  {
    id: "classic",
    label: "經典冰室",
    prompt:
      "nostalgic Hong Kong cha chaan teng poster aesthetic, deep navy blue and gold, " +
      "brush-stroke calligraphy feel, warm cream background, subtle paper texture",
  },
  {
    id: "modern",
    label: "簡約現代",
    prompt:
      "clean modern brand poster, deep navy blue field with crisp gold accents, " +
      "generous white space, minimal geometric shapes, premium beer branding",
  },
  {
    id: "promo",
    label: "大膽促銷",
    prompt:
      "bold high-impact promotional poster, strong navy and gold contrast, " +
      "large graphic burst shapes, energetic layout, eye-catching from across the street",
  },
  {
    id: "festive",
    label: "節慶金裝",
    prompt:
      "festive celebratory poster, rich gold foil textures on deep navy, " +
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
