"use client";

import { useState } from "react";
import { tenantGenerateStickerDesignApiPath } from "@/lib/tenant/paths";
import { fileToDataUrl } from "@/lib/wall-sticker/render";
import {
  STICKER_STYLES,
  type StickerStyleId,
} from "@/lib/wall-sticker/stickerStyles";

interface Props {
  /** 租戶 token，用嚟砌 API 路徑 */
  token: string;
  designSrc: string | null;
  /** 貼位長寬比（闊 ÷ 高），用嚟叫 AI 出啱比例嘅設計稿 */
  aspectRatio: number;
  onDesignChange: (src: string | null) => void;
}

/** 設計稿來源：AI 生成 Blue Girl 風格底圖，或者上載現成 artwork */
export default function DesignPicker({
  token,
  designSrc,
  aspectRatio,
  onDesignChange,
}: Props) {
  const [merchantName, setMerchantName] = useState("");
  const [highlight, setHighlight] = useState("");
  const [styleId, setStyleId] = useState<StickerStyleId>(STICKER_STYLES[0].id);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(file: File) {
    setError(null);
    try {
      onDesignChange(await fileToDataUrl(file));
    } catch {
      setError("讀取檔案失敗，請再試一次");
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(tenantGenerateStickerDesignApiPath(token), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantName: merchantName.trim(),
          highlight: highlight.trim(),
          style: styleId,
          aspectRatio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "生成失敗");
      onDesignChange(data.imageUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失敗");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            AI 生成
          </span>
          <span className="text-sm font-medium text-slate-700">
            即場出一張 BLUE GIRL 風格設計稿
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">商戶名稱</span>
            <input
              type="text"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="例如：貳號冰室"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">
              主打內容（可留空）
            </span>
            <input
              type="text"
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="例如：凍藍妹 買二送一"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-xs text-slate-500">風格</span>
          <div className="flex flex-wrap gap-2">
            {STICKER_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyleId(s.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  styleId === s.id
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {generating ? "AI 生成中…（約 30–60 秒）" : "✨ 生成設計稿"}
        </button>

        <p className="text-xs text-slate-400">
          AI 只負責底圖同氛圍。中文字可能會出錯字，落單前請人手核對，或者直接上載
          design team 出嘅 artwork。
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <label className="flex cursor-pointer items-center justify-center gap-2 text-sm text-slate-600">
          <span>📎 上載現成設計稿（PNG / JPG）</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
            }}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {designSrc && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              目前使用嘅設計稿
            </span>
            <button
              type="button"
              onClick={() => onDesignChange(null)}
              className="text-xs text-slate-400 hover:text-red-600"
            >
              移除
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={designSrc}
            alt="牆貼設計稿"
            className="mx-auto max-h-48 rounded-lg border border-slate-100"
          />
        </div>
      )}
    </div>
  );
}
