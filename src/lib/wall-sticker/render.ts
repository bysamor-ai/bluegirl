/**
 * Canvas 合成 — 將設計稿以真正嘅投影變換貼落相片中框選咗嘅四邊形。
 * 由 wallstickerestimatordemo.html 移植。呢個模組要用到 DOM canvas，
 * 純數學部分喺 geometry.ts。
 */

import {
  applyMat3,
  bilinearSample,
  invert3x3,
  isQuadUsable,
  pointInPolygon,
  squareToQuadHomography,
  type Point,
  type Quad,
} from "./geometry";
import type { Obstruction } from "./types";

/** 合成畫布最長邊；太大會拖慢逐像素運算 */
export const MAX_CANVAS_DIM = 1400;

/** 設計稿取樣用嘅最長邊 */
const MAX_DESIGN_DIM = 1000;

export interface WarpOptions {
  /** 融合相片本身嘅光暗（multiply），令貼圖睇落唔會太「貼紙感」 */
  blendLighting?: boolean;
  /** 畫邊緣陰影 */
  drawShadow?: boolean;
}

/** 載入圖片（data URL 或同源 / CORS 允許嘅 URL）。 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("圖片載入失敗"));
    img.src = src;
  });
}

/** 讀 File 做 data URL。 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.readAsDataURL(file);
  });
}

/**
 * 將 designImg 以 per-pixel projective transform 貼入 quad（畫布像素座標）。
 * obstructions 入面嘅像素會保留原相，所以人或者柱唔會俾貼圖蓋住。
 */
export function warpDesignIntoQuad(
  ctx: CanvasRenderingContext2D,
  designImg: CanvasImageSource,
  quad: Quad,
  obstructions: Obstruction[] = [],
  options: WarpOptions = {}
): void {
  const { blendLighting = true, drawShadow = true } = options;
  if (!isQuadUsable(quad, 4)) return;

  const canvasW = ctx.canvas.width;
  const canvasH = ctx.canvas.height;

  const dw =
    (designImg as HTMLImageElement).naturalWidth ||
    (designImg as HTMLCanvasElement).width;
  const dh =
    (designImg as HTMLImageElement).naturalHeight ||
    (designImg as HTMLCanvasElement).height;
  if (!dw || !dh) return;

  // 先將設計稿縮到合理大細再取樣
  const srcCanvas = document.createElement("canvas");
  const srcScale = Math.min(1, MAX_DESIGN_DIM / Math.max(dw, dh));
  srcCanvas.width = Math.max(1, Math.round(dw * srcScale));
  srcCanvas.height = Math.max(1, Math.round(dh * srcScale));
  const srcCtx = srcCanvas.getContext("2d");
  if (!srcCtx) return;
  srcCtx.drawImage(designImg, 0, 0, srcCanvas.width, srcCanvas.height);
  const srcData = srcCtx.getImageData(
    0,
    0,
    srcCanvas.width,
    srcCanvas.height
  ).data;

  const H = squareToQuadHomography(quad);
  const Hinv = invert3x3(H);
  if (!Hinv) return;

  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(canvasW, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(canvasH, Math.ceil(Math.max(...ys)));
  if (x1 <= x0 || y1 <= y0) return;

  const boxW = x1 - x0;
  const boxH = y1 - y0;
  const dest = ctx.getImageData(x0, y0, boxW, boxH);
  const destData = dest.data;

  const activeObstructions = obstructions.filter((poly) => poly.length >= 3);

  for (let py = 0; py < boxH; py++) {
    const imgY = y0 + py + 0.5;
    for (let px = 0; px < boxW; px++) {
      const imgX = x0 + px + 0.5;
      if (!pointInPolygon(imgX, imgY, quad)) continue;
      if (
        activeObstructions.some((poly) => pointInPolygon(imgX, imgY, poly))
      ) {
        continue;
      }
      const uv = applyMat3(Hinv, imgX, imgY);
      if (uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1) continue;

      const [r, g, b] = bilinearSample(
        srcData,
        srcCanvas.width,
        srcCanvas.height,
        uv.x * (srcCanvas.width - 1),
        uv.y * (srcCanvas.height - 1)
      );

      const di = (py * boxW + px) * 4;
      if (blendLighting) {
        // 用原相嘅亮度做柔和 multiply，保留牆身光暗變化
        const wallLuma =
          (destData[di] * 0.299 +
            destData[di + 1] * 0.587 +
            destData[di + 2] * 0.114) /
          255;
        // 收窄到 0.88–1.08：夠見到牆身光暗變化，但仍然似一張不透明嘅印刷貼紙，
        // 唔會變成「投影」效果
        const k = Math.min(1.08, Math.max(0.88, 0.88 + wallLuma * 0.24));
        destData[di] = Math.min(255, r * k);
        destData[di + 1] = Math.min(255, g * k);
        destData[di + 2] = Math.min(255, b * k);
      } else {
        destData[di] = r;
        destData[di + 1] = g;
        destData[di + 2] = b;
      }
      destData[di + 3] = 255;
    }
  }
  ctx.putImageData(dest, x0, y0);

  if (drawShadow) {
    drawQuadEdges(ctx, quad, activeObstructions);
  }
}

/** 右邊同底邊加淡淡投影，四邊加細線，令貼圖有厚度感。 */
function drawQuadEdges(
  ctx: CanvasRenderingContext2D,
  quad: Quad,
  obstructions: Obstruction[]
): void {
  const edges: Array<[Point, Point]> = [
    [quad[0], quad[1]],
    [quad[1], quad[2]],
    [quad[2], quad[3]],
    [quad[3], quad[0]],
  ];
  const crossesObstruction = (a: Point, b: Point) =>
    obstructions.some(
      (poly) =>
        pointInPolygon(a.x, a.y, poly) || pointInPolygon(b.x, b.y, poly)
    );

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 4;
  for (const [a, b] of [edges[1], edges[2]]) {
    if (crossesObstruction(a, b)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.5;
  for (const [a, b] of edges) {
    if (crossesObstruction(a, b)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** 依據相片原始尺寸算出合成畫布大細（限制最長邊）。 */
export function fitCanvasSize(
  naturalW: number,
  naturalH: number
): { width: number; height: number } {
  const scale = Math.min(1, MAX_CANVAS_DIM / Math.max(naturalW, naturalH));
  return {
    width: Math.max(1, Math.round(naturalW * scale)),
    height: Math.max(1, Math.round(naturalH * scale)),
  };
}
