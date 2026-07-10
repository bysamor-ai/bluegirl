/**
 * BLUE GIRL 品牌背景主題 config。
 * 圖片放喺 public/backgrounds/，可以喺呢度加減背景選項。
 * 揀咗背景圖後，餐牌會用品牌版面（深藍字＋安全邊距避開品牌 footer）。
 */

export const backgroundIds = [
  "none",
  "gold-landscape",
  "gold-portrait",
  "white-landscape",
  "white-portrait",
] as const;

export type BackgroundId = (typeof backgroundIds)[number];

export interface BackgroundConfig {
  id: BackgroundId;
  /** zh-HK 顯示名稱 */
  label: string;
  /** 圖片路徑（none 為 null） */
  src: string | null;
  /** 圖片長寬比（CSS aspect-ratio 值） */
  aspect: string;
  /** 內容安全區 padding（避開品牌 footer／樽身） */
  contentClass: string;
}

export const backgrounds: Record<BackgroundId, BackgroundConfig> = {
  none: {
    id: "none",
    label: "無背景（用主題色）",
    src: null,
    aspect: "auto",
    contentClass: "",
  },
  "gold-landscape": {
    id: "gold-landscape",
    label: "金啤・橫向",
    src: "/backgrounds/gold-landscape.jpg",
    aspect: "7017 / 4962",
    contentClass: "px-[7%] pt-[5%] pb-[26%] sm:pr-[26%]",
  },
  "gold-portrait": {
    id: "gold-portrait",
    label: "金啤・直向（Light）",
    src: "/backgrounds/gold-portrait.jpg",
    aspect: "1182 / 2363",
    contentClass: "px-[9%] pt-[6%] pb-[24%]",
  },
  "white-landscape": {
    id: "white-landscape",
    label: "雙麥釀造・橫向",
    src: "/backgrounds/white-landscape.jpg",
    aspect: "4962 / 3509",
    contentClass: "px-[7%] pt-[5%] pb-[30%]",
  },
  "white-portrait": {
    id: "white-portrait",
    label: "雙麥釀造・直向",
    src: "/backgrounds/white-portrait.jpg",
    aspect: "3509 / 4961",
    contentClass: "px-[8%] pt-[6%] pb-[28%]",
  },
};

export function getBackground(id: string | null | undefined): BackgroundConfig {
  return backgrounds[(id as BackgroundId) ?? "none"] ?? backgrounds.none;
}
