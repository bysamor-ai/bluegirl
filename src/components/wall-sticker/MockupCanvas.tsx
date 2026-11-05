"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isQuadUsable, toPixels } from "@/lib/wall-sticker/geometry";
import {
  fitCanvasSize,
  loadImage,
  warpDesignIntoQuad,
} from "@/lib/wall-sticker/render";
import type { Obstruction, Quad } from "@/lib/wall-sticker/types";

interface Props {
  photoSrc: string;
  designSrc: string | null;
  quad: Quad;
  obstructions: Obstruction[];
  naturalW: number;
  naturalH: number;
  blendLighting: boolean;
  /** 合成好嘅 data URL，交返俾上層做 AI 精修 / 存檔 */
  onRendered?: (dataUrl: string) => void;
}

/** In-situ mockup：將設計稿以透視變換貼落相片框選咗嘅位置 */
export default function MockupCanvas({
  photoSrc,
  designSrc,
  quad,
  obstructions,
  naturalW,
  naturalH,
  blendLighting,
  onRendered,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tokenRef = useRef(0);
  const [warning, setWarning] = useState<string | null>(null);

  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !ctx) return;

    const token = ++tokenRef.current;
    const { width, height } = fitCanvasSize(naturalW, naturalH);
    canvas.width = width;
    canvas.height = height;

    let photoImg: HTMLImageElement;
    try {
      photoImg = await loadImage(photoSrc);
    } catch {
      setWarning("相片載入失敗");
      return;
    }
    if (token !== tokenRef.current) return;

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(photoImg, 0, 0, width, height);

    if (!designSrc) {
      setWarning(null);
      onRendered?.(canvas.toDataURL("image/jpeg", 0.92));
      return;
    }

    const quadPx = toPixels(quad, width, height) as Quad;
    if (!isQuadUsable(quadPx, 4)) {
      setWarning("框選嘅範圍太窄或者角位交叉咗，請重新拖四個角。");
      return;
    }

    let designImg: HTMLImageElement;
    try {
      designImg = await loadImage(designSrc);
    } catch {
      setWarning("設計稿載入失敗");
      return;
    }
    if (token !== tokenRef.current) return;

    const obstructionsPx = obstructions.map(
      (poly) => toPixels(poly, width, height) as Obstruction
    );

    warpDesignIntoQuad(ctx, designImg, quadPx, obstructionsPx, {
      blendLighting,
    });
    setWarning(null);
    onRendered?.(canvas.toDataURL("image/jpeg", 0.92));
    // onRendered 由上層用 useCallback 包住，唔會每 render 都變
  }, [
    photoSrc,
    designSrc,
    quad,
    obstructions,
    naturalW,
    naturalH,
    blendLighting,
    onRendered,
  ]);

  useEffect(() => {
    // 用 timeout 而唔用 requestAnimationFrame：rAF 喺背景分頁唔會 fire，
    // 用家切返轉頭就會見到一張過期嘅效果圖。順便做埋拖角時嘅節流。
    const id = setTimeout(() => void render(), 50);
    return () => clearTimeout(id);
  }, [render]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `wall-sticker-mockup-${Date.now()}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.95);
    link.click();
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <canvas ref={canvasRef} className="block h-auto w-full" />
      </div>

      {warning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {warning}
        </p>
      )}

      <button
        type="button"
        onClick={handleDownload}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        ⬇ 下載 mockup
      </button>
    </div>
  );
}
