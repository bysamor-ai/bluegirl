/**
 * AI 海報設計風格參考圖 config。
 * 生成海報時會將風格圖傳俾 gpt-image-2/edit 做設計語言參考
 * （排版、構圖、字體感覺、價錢展示方式 — 唔會照抄內容）。
 * 圖片放喺 public/poster-styles/，可以喺呢度加減風格。
 */

export const posterStyleIds = [
  "chinese-elegant",
  "festive-gold",
  "bold-red",
] as const;

export type PosterStyleId = (typeof posterStyleIds)[number];

export interface PosterStyleConfig {
  id: PosterStyleId;
  /** zh-HK 顯示名稱 */
  label: string;
  /** 傳俾 AI 嘅風格描述（英文，生成較穩定） */
  styleHint: string;
  /** 參考圖路徑 */
  src: string;
}

export const posterStyles: Record<PosterStyleId, PosterStyleConfig> = {
  "chinese-elegant": {
    id: "chinese-elegant",
    label: "雅致中式",
    styleHint:
      "elegant modern Chinese aesthetic, dishes on ceramic plates floating on a light " +
      "textured background, calligraphy-style title, red accent seals and dividers",
    src: "/poster-styles/chinese-elegant.jpg",
  },
  "festive-gold": {
    id: "festive-gold",
    label: "華麗節慶",
    styleHint:
      "festive premium layout on a deep rich background, gold decorative title " +
      "calligraphy, dishes in a neat grid with gold dish names and clear prices",
    src: "/poster-styles/festive-gold.jpg",
  },
  "bold-red": {
    id: "bold-red",
    label: "大膽醒目",
    styleHint:
      "bold dynamic promotional layout, one large hero dish plus smaller dishes " +
      "around it, big vertical display typography, strong price callout badges",
    src: "/poster-styles/bold-red.jpg",
  },
};

export function getPosterStyle(
  id: string | null | undefined
): PosterStyleConfig {
  return (
    posterStyles[(id as PosterStyleId) ?? "chinese-elegant"] ??
    posterStyles["chinese-elegant"]
  );
}

/** 每次生成隨機揀一款設計風格 */
export function randomPosterStyle(): PosterStyleConfig {
  const id =
    posterStyleIds[Math.floor(Math.random() * posterStyleIds.length)];
  return posterStyles[id];
}
