"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import DesignPicker from "./DesignPicker";
import MockupCanvas from "./MockupCanvas";
import PhotoMarker from "./PhotoMarker";
import QuoteCard from "./QuoteCard";
import SpecForm from "./SpecForm";
import { calculateQuote, type LengthUnit } from "@/lib/wall-sticker/pricing";
import { fileToDataUrl } from "@/lib/wall-sticker/render";
import {
  DEFAULT_QUAD,
  type MarkMode,
  type Obstruction,
  type Quad,
} from "@/lib/wall-sticker/types";

/** 牆貼報價工作台：上載相 → 框選貼位 → 入尺寸 → 出報價同 mockup */
export default function WallStickerStudio() {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState({ w: 1200, h: 800 });
  const [quad, setQuad] = useState<Quad>(DEFAULT_QUAD);
  const [obstructions, setObstructions] = useState<Obstruction[]>([]);
  const [mode, setMode] = useState<MarkMode>("area");

  const [width, setWidth] = useState(1.2);
  const [height, setHeight] = useState(1.0);
  const [unit, setUnit] = useState<LengthUnit>("m");

  const [designSrc, setDesignSrc] = useState<string | null>(null);
  const [blendLighting, setBlendLighting] = useState(true);

  const [refining, setRefining] = useState(false);
  const [refinedSrc, setRefinedSrc] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const mockupDataUrlRef = useRef<string | null>(null);

  const quote = useMemo(
    () => calculateQuote(width, height, unit),
    [width, height, unit]
  );

  const aspectRatio = useMemo(() => {
    if (quote.heightM <= 0) return 1;
    return quote.widthM / quote.heightM;
  }, [quote.widthM, quote.heightM]);

  const handleRendered = useCallback((dataUrl: string) => {
    mockupDataUrlRef.current = dataUrl;
  }, []);

  async function handlePhotoUpload(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setPhotoSrc(dataUrl);
    setQuad(DEFAULT_QUAD);
    setObstructions([]);
    setMode("area");
    setRefinedSrc(null);
  }

  function handleUnitChange(next: LengthUnit) {
    if (next === unit) return;
    // 換單位時保持實際尺寸唔變
    const factor = next === "cm" ? 100 : 0.01;
    setWidth(Math.round(width * factor * 1000) / 1000);
    setHeight(Math.round(height * factor * 1000) / 1000);
    setUnit(next);
  }

  async function handleRefine() {
    const mockup = mockupDataUrlRef.current;
    if (!mockup) return;
    setRefining(true);
    setRefineError(null);
    setRefinedSrc(null);
    try {
      const res = await fetch("/api/refine-mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mockupDataUrl: mockup }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "精修失敗");
      setRefinedSrc(data.imageUrl);
    } catch (e) {
      setRefineError(e instanceof Error ? e.message : "精修失敗");
    } finally {
      setRefining(false);
    }
  }

  if (!photoSrc) {
    return (
      <div className="mx-auto max-w-xl">
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center transition hover:border-blue-400 hover:bg-blue-50/40">
          <span className="text-4xl">📷</span>
          <span className="text-base font-medium text-slate-700">
            上載商戶店舖相片
          </span>
          <span className="text-sm text-slate-500">
            影低想貼牆貼嘅位置，之後喺相上面框出範圍
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePhotoUpload(file);
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* 步驟 1：框選 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">① 框出貼位</h2>
            <label className="cursor-pointer text-xs text-blue-600 hover:underline">
              換相
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handlePhotoUpload(file);
                }}
              />
            </label>
          </div>

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("area")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "area"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              ▭ 框貼位
            </button>
            <button
              type="button"
              onClick={() => setMode("obstruction")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                mode === "obstruction"
                  ? "bg-red-600 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              🛡 保護前景物件
            </button>
          </div>

          <PhotoMarker
            photoSrc={photoSrc}
            quad={quad}
            obstructions={obstructions}
            mode={mode}
            onQuadChange={setQuad}
            onObstructionsChange={setObstructions}
            onPhotoLoad={(w, h) => setNatural({ w, h })}
          />
        </section>

        {/* 步驟 2：尺寸同報價 */}
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-base font-semibold">② 尺寸同報價</h2>
          <SpecForm
            width={width}
            height={height}
            unit={unit}
            onWidthChange={setWidth}
            onHeightChange={setHeight}
            onUnitChange={handleUnitChange}
          />
          <QuoteCard quote={quote} />
        </section>
      </div>

      {/* 步驟 3：設計稿 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">③ 牆貼設計稿</h2>
        <DesignPicker
          designSrc={designSrc}
          aspectRatio={aspectRatio}
          onDesignChange={setDesignSrc}
        />
      </section>

      {/* 步驟 4：mockup */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">④ 實景效果圖</h2>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={blendLighting}
              onChange={(e) => setBlendLighting(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            融合現場光暗
          </label>
        </div>

        {!designSrc && (
          <p className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            仲未有設計稿 — 上面生成或者上載一張，就會即時貼落框選咗嘅位置。
          </p>
        )}

        <MockupCanvas
          photoSrc={photoSrc}
          designSrc={designSrc}
          quad={quad}
          obstructions={obstructions}
          naturalW={natural.w}
          naturalH={natural.h}
          blendLighting={blendLighting}
          onRendered={handleRendered}
        />

        <div className="mt-4 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={handleRefine}
            disabled={!designSrc || refining}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-40"
          >
            {refining
              ? "AI 精修中…（約 30–60 秒）"
              : "✨ AI 精修：加返真實光影同反光"}
          </button>
          <p className="mt-2 text-xs text-slate-400">
            上面嘅效果圖已經係即時、免費、可調。精修只係將佢交俾 AI
            執靚光影，落單前記得對返設計稿內容。
          </p>

          {refineError && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {refineError}
            </p>
          )}

          {refinedSrc && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-slate-500">
                AI 精修版本
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={refinedSrc}
                alt="AI 精修後嘅實景效果圖"
                className="w-full rounded-xl border border-slate-200"
              />
              <a
                href={refinedSrc}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-blue-600 hover:underline"
              >
                開新分頁睇原圖 ↗
              </a>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
