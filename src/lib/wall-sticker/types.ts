import type { Point, Quad } from "./geometry";

export type { Point, Quad };

/** 前景遮擋區：貼圖唔會蓋過呢啲多邊形（人、柱、招牌等） */
export type Obstruction = Point[];

/** 相片裏面預設嘅貼位（0–1 正規化，左上→右上→右下→左下） */
export const DEFAULT_QUAD: Quad = [
  { x: 0.2, y: 0.28 },
  { x: 0.8, y: 0.28 },
  { x: 0.8, y: 0.72 },
  { x: 0.2, y: 0.72 },
];

export const QUAD_LABELS = ["左上", "右上", "右下", "左下"] as const;

/** 框選模式 */
export type MarkMode = "area" | "obstruction";
