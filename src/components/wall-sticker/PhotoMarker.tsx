"use client";

import { useCallback, useRef, useState } from "react";
import { clamp01, type Point } from "@/lib/wall-sticker/geometry";
import {
  QUAD_LABELS,
  type MarkMode,
  type Obstruction,
  type Quad,
} from "@/lib/wall-sticker/types";

interface Props {
  photoSrc: string;
  quad: Quad;
  obstructions: Obstruction[];
  mode: MarkMode;
  /** 用 functional update，連續事件（例如按住方向鍵）唔會用到舊 state */
  onQuadChange: (update: (prev: Quad) => Quad) => void;
  onObstructionsChange: (obstructions: Obstruction[]) => void;
  onPhotoLoad: (naturalW: number, naturalH: number) => void;
}

/**
 * 框選貼位：喺相片上面拖四個角，或者喺遮擋模式逐點框出前景物件。
 * 所有座標都係 0–1 正規化，唔受顯示尺寸影響。
 */
export default function PhotoMarker({
  photoSrc,
  quad,
  obstructions,
  mode,
  onQuadChange,
  onObstructionsChange,
  onPhotoLoad,
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);
  const [draft, setDraft] = useState<Point[]>([]);

  /** 由指標事件換算成 0–1 座標 */
  const toNormalised = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }, []);

  const handlePointerDown = (index: number) => (e: React.PointerEvent) => {
    if (mode !== "area") return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = index;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const index = draggingRef.current;
    if (index === null) return;
    const p = toNormalised(e.clientX, e.clientY);
    if (!p) return;
    onQuadChange(
      (prev) => prev.map((corner, i) => (i === index ? p : corner)) as Quad
    );
  };

  const endDrag = (e: React.PointerEvent) => {
    if (draggingRef.current === null) return;
    const target = e.target as HTMLElement;
    if (target.hasPointerCapture?.(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = null;
  };

  /** 遮擋模式：撳一下加一點 */
  const handleStageClick = (e: React.MouseEvent) => {
    if (mode !== "obstruction") return;
    const p = toNormalised(e.clientX, e.clientY);
    if (!p) return;
    setDraft((prev) => [...prev, p]);
  };

  /** 鍵盤微調（無障礙 + 精準對位） */
  const handleKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.02 : 0.005;
    const deltas: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[e.key];
    if (!delta) return;
    e.preventDefault();
    onQuadChange(
      (prev) =>
        prev.map((corner, i) =>
          i === index
            ? {
                x: clamp01(corner.x + delta[0]),
                y: clamp01(corner.y + delta[1]),
              }
            : corner
        ) as Quad
    );
  };

  const finishShape = () => {
    if (draft.length < 3) return;
    onObstructionsChange([...obstructions, draft]);
    setDraft([]);
  };

  const toPath = (points: readonly Point[]) =>
    points.map((p) => `${p.x * 100},${p.y * 100}`).join(" ");

  return (
    <div>
      <div
        ref={stageRef}
        onClick={handleStageClick}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`relative select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${
          mode === "obstruction" ? "cursor-crosshair" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoSrc}
          alt="商戶店舖相片"
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            onPhotoLoad(img.naturalWidth || 1200, img.naturalHeight || 800);
          }}
          className="block w-full"
        />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {/* 貼位輪廓 */}
          <polygon
            points={toPath(quad)}
            fill="rgba(34,197,94,0.22)"
            stroke="#22c55e"
            strokeWidth="0.4"
            vectorEffect="non-scaling-stroke"
          />
          {/* 已完成嘅遮擋區 */}
          {obstructions.map((poly, i) => (
            <polygon
              key={i}
              points={toPath(poly)}
              fill="rgba(239,68,68,0.25)"
              stroke="#ef4444"
              strokeWidth="0.4"
              strokeDasharray="2 1.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* 繪製中嘅遮擋區 */}
          {draft.length > 0 && (
            <>
              <polyline
                points={toPath(draft)}
                fill="rgba(239,68,68,0.15)"
                stroke="#ef4444"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
              {draft.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r="0.8"
                  fill="#ef4444"
                />
              ))}
            </>
          )}
        </svg>

        {/* 四個角控制點 */}
        {mode === "area" &&
          quad.map((p, i) => (
            <button
              key={i}
              type="button"
              aria-label={`貼位${QUAD_LABELS[i]}角，可拖動或用方向鍵微調`}
              onPointerDown={handlePointerDown(i)}
              onKeyDown={handleKeyDown(i)}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              className="absolute z-10 h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white bg-emerald-500 shadow-md ring-1 ring-emerald-700/40 active:cursor-grabbing"
            />
          ))}
      </div>

      {mode === "area" ? (
        <p className="mt-2 text-sm text-slate-500">
          拖四個綠色圓點，令綠框啱啱好蓋住想貼牆貼嘅位置（可以拖成斜角，貼圖會跟住透視）。
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-slate-500">
            喺牆前面嘅嘢（人、柱、招牌）四周撳點框起佢，貼圖就唔會蓋過去。撳夠 3
            點就可以完成。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDraft((prev) => prev.slice(0, -1))}
              disabled={draft.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              ↩ 撤銷上一點
            </button>
            <button
              type="button"
              onClick={finishShape}
              disabled={draft.length < 3}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              ✓ 完成呢個遮擋區
            </button>
          </div>
          {obstructions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {obstructions.map((_, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs text-red-700"
                >
                  遮擋區 {i + 1}
                  <button
                    type="button"
                    aria-label={`移除遮擋區 ${i + 1}`}
                    onClick={() =>
                      onObstructionsChange(
                        obstructions.filter((_, j) => j !== i)
                      )
                    }
                    className="text-red-500 hover:text-red-800"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
