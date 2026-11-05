import { describe, expect, it } from "vitest";
import {
  applyMat3,
  bilinearSample,
  invert3x3,
  isQuadUsable,
  pointInPolygon,
  polygonArea,
  squareToQuadHomography,
  toPixels,
  type Point,
  type Quad,
} from "./geometry";

const UNIT_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

function expectPointClose(actual: Point, expected: Point, digits = 6) {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
}

describe("squareToQuadHomography", () => {
  it("長方形（affine 分支）：四角準確對應", () => {
    const quad: Quad = [
      { x: 100, y: 50 },
      { x: 400, y: 50 },
      { x: 400, y: 250 },
      { x: 100, y: 250 },
    ];
    const H = squareToQuadHomography(quad);
    UNIT_CORNERS.forEach((corner, i) => {
      expectPointClose(applyMat3(H, corner.x, corner.y), quad[i]);
    });
  });

  it("傾斜梯形（projective 分支）：四角準確對應", () => {
    const quad: Quad = [
      { x: 120, y: 80 },
      { x: 520, y: 40 },
      { x: 560, y: 320 },
      { x: 90, y: 260 },
    ];
    const H = squareToQuadHomography(quad);
    UNIT_CORNERS.forEach((corner, i) => {
      expectPointClose(applyMat3(H, corner.x, corner.y), quad[i]);
    });
  });

  it("反解可以由像素座標拎返 uv", () => {
    const quad: Quad = [
      { x: 120, y: 80 },
      { x: 520, y: 40 },
      { x: 560, y: 320 },
      { x: 90, y: 260 },
    ];
    const H = squareToQuadHomography(quad);
    const Hinv = invert3x3(H)!;
    expect(Hinv).not.toBeNull();
    // 四邊形中心點反解後應該落喺 uv 範圍內
    const centre = applyMat3(H, 0.5, 0.5);
    const uv = applyMat3(Hinv, centre.x, centre.y);
    expectPointClose(uv, { x: 0.5, y: 0.5 });
  });
});

describe("invert3x3", () => {
  it("退化矩陣回傳 null", () => {
    expect(invert3x3([1, 2, 3, 2, 4, 6, 3, 6, 9])).toBeNull();
  });
});

describe("polygonArea / isQuadUsable", () => {
  it("單位正方形面積為 1", () => {
    expect(polygonArea(UNIT_CORNERS)).toBeCloseTo(1, 10);
  });

  it("正常四邊形可用", () => {
    const quad: Quad = [
      { x: 0.1, y: 0.2 },
      { x: 0.6, y: 0.2 },
      { x: 0.6, y: 0.7 },
      { x: 0.1, y: 0.7 },
    ];
    expect(isQuadUsable(quad)).toBe(true);
  });

  it("四點壓成一條線 → 唔可用", () => {
    const line: Quad = [
      { x: 0.1, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 0.1, y: 0.5 },
    ];
    expect(isQuadUsable(line)).toBe(false);
  });

  it("含 NaN 嘅四邊形 → 唔可用", () => {
    const bad: Quad = [
      { x: Number.NaN, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(isQuadUsable(bad)).toBe(false);
  });
});

describe("pointInPolygon", () => {
  const square: Point[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("內點 / 外點", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(15, 5, square)).toBe(false);
    expect(pointInPolygon(-1, 5, square)).toBe(false);
  });

  it("凹多邊形（L 形）嘅凹位當外面", () => {
    const lShape: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon(2, 2, lShape)).toBe(true);
    expect(pointInPolygon(8, 8, lShape)).toBe(false);
  });
});

describe("bilinearSample", () => {
  // 2×2 影像：紅、綠 / 藍、白
  const data = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);

  it("落喺像素中心攞返原色", () => {
    expect(bilinearSample(data, 2, 2, 0, 0).slice(0, 3)).toEqual([255, 0, 0]);
    expect(bilinearSample(data, 2, 2, 1, 0).slice(0, 3)).toEqual([0, 255, 0]);
  });

  it("兩點之間做插值", () => {
    const [r, g] = bilinearSample(data, 2, 2, 0.5, 0);
    expect(r).toBeCloseTo(127.5, 4);
    expect(g).toBeCloseTo(127.5, 4);
  });

  it("超出範圍嘅座標會夾返邊界，唔會出黑邊", () => {
    expect(bilinearSample(data, 2, 2, -5, -5).slice(0, 3)).toEqual([255, 0, 0]);
    expect(bilinearSample(data, 2, 2, 99, 99).slice(0, 3)).toEqual([
      255, 255, 255,
    ]);
  });
});

describe("toPixels", () => {
  it("正規化座標乘返畫布尺寸", () => {
    expect(toPixels([{ x: 0.5, y: 0.25 }], 800, 400)).toEqual([
      { x: 400, y: 100 },
    ]);
  });
});
