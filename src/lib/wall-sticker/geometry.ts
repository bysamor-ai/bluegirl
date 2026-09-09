/**
 * 幾何運算 — 全部純函數，唔掂 DOM，方便測試。
 * 由 wallstickerestimatordemo.html 移植並加上型別。
 */

export interface Point {
  x: number;
  y: number;
}

/** 四邊形，順序為 左上、右上、右下、左下 */
export type Quad = [Point, Point, Point, Point];

/** 3×3 矩陣（row-major，9 個數） */
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

/**
 * 解出將單位正方形 (0,0)-(1,0)-(1,1)-(0,1) 映射到任意四邊形嘅 homography。
 * 相比兩個 affine 三角形，projective 變換可以完全準確表示傾斜嘅長方形，
 * 唔會出現對角線接縫。
 */
export function squareToQuadHomography(quad: Quad): Mat3 {
  const [p0, p1, p2, p3] = quad;
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  let a: number, b: number, c: number, d: number, e: number, f: number;
  let g: number, h: number;

  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    // 平行四邊形 — 退化成 affine
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    f = p0.y;
    g = 0;
    h = 0;
  } else {
    const denom = dx1 * dy2 - dx2 * dy1;
    g = denom !== 0 ? (dx3 * dy2 - dx2 * dy3) / denom : 0;
    h = denom !== 0 ? (dx1 * dy3 - dx3 * dy1) / denom : 0;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }

  return [a, b, c, d, e, f, g, h, 1];
}

/** 反轉 3×3 矩陣；行列式近 0（退化）時回傳 null。 */
export function invert3x3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const det =
    a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const id = 1 / det;
  return [
    (e * i - f * h) * id, (c * h - b * i) * id, (b * f - c * e) * id,
    (f * g - d * i) * id, (a * i - c * g) * id, (c * d - a * f) * id,
    (d * h - e * g) * id, (b * g - a * h) * id, (a * e - b * d) * id,
  ];
}

/** 用矩陣變換一點（齊次座標，除返 w）。 */
export function applyMat3(m: Mat3, x: number, y: number): Point {
  const [a, b, c, d, e, f, g, h, i] = m;
  const w = g * x + h * y + i;
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w };
}

/** 射線法判斷點是否喺多邊形內（支援凹多邊形）。 */
export function pointInPolygon(
  px: number,
  py: number,
  poly: readonly Point[]
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 多邊形面積（shoelace，絕對值）。 */
export function polygonArea(poly: readonly Point[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(sum / 2);
}

/**
 * 四邊形是否可以用嚟做 warp。
 * 面積太細（近乎一條線）或者 homography 反解唔到（自相交）都當唔可用。
 */
export function isQuadUsable(quad: Quad, minArea = 1e-4): boolean {
  if (quad.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return false;
  }
  if (polygonArea(quad) < minArea) return false;
  return invert3x3(squareToQuadHomography(quad)) !== null;
}

/**
 * 雙線性取樣 RGBA 像素。座標會夾喺影像範圍內，所以邊界唔會出黑邊。
 * 回傳 [r, g, b, a]。
 */
export function bilinearSample(
  data: Uint8ClampedArray | number[],
  w: number,
  h: number,
  x: number,
  y: number
): [number, number, number, number] {
  const cx = Math.min(Math.max(x, 0), w - 1);
  const cy = Math.min(Math.max(y, 0), h - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const tx = cx - x0;
  const ty = cy - y0;
  const idx = (xx: number, yy: number) => (yy * w + xx) * 4;
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const top =
      data[idx(x0, y0) + k] * (1 - tx) + data[idx(x1, y0) + k] * tx;
    const bottom =
      data[idx(x0, y1) + k] * (1 - tx) + data[idx(x1, y1) + k] * tx;
    out[k] = top * (1 - ty) + bottom * ty;
  }
  return out;
}

/** 將 0–1 正規化座標換成像素座標。 */
export function toPixels(
  points: readonly Point[],
  width: number,
  height: number
): Point[] {
  return points.map((p) => ({ x: p.x * width, y: p.y * height }));
}

/** 夾喺 0–1 之間。 */
export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
