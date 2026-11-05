"use client";

import { useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import type { RestaurantFormValues } from "@/lib/schemas";
import { tenantUploadApiPath } from "@/lib/tenant/paths";

interface MenuItemRowProps {
  /** 租戶 token，用嚟砌上傳 API 路徑 `/api/t/<token>/upload` */
  token: string;
  index: number;
  total: number;
  generating: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onGenerate: () => void;
}

/** 單個菜式編輯列：相片上載／AI 生成（白色背景）、名稱、價錢、排序、移除 */
export default function MenuItemRow({
  token,
  index,
  total,
  generating,
  canRemove,
  onMoveUp,
  onMoveDown,
  onRemove,
  onGenerate,
}: MenuItemRowProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<RestaurantFormValues>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const imageUrl = watch(`items.${index}.imageUrl`);
  const itemErrors = errors.items?.[index];

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 容許重覆揀同一個檔案
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(tenantUploadApiPath(token), { method: "POST", body });
      // 平台層（例如 body 過大）可能回非 JSON，所以 parse 失敗要照出通用訊息
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.url !== "string") {
        throw new Error(
          typeof data?.error === "string" ? data.error : "上傳失敗，請稍後再試"
        );
      }
      setValue(`items.${index}.imageUrl`, data.url, { shouldDirty: true });
    } catch (e) {
      // fetch 本身失敗（斷網）會拋 TypeError，訊息係英文，唔直接顯示
      setUploadError(
        e instanceof Error && !(e instanceof TypeError) ? e.message : "上傳失敗，請檢查網絡後再試"
      );
    } finally {
      setUploading(false);
    }
  }

  const btn =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* 相片區 */}
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="菜式相片"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                未有相片
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex gap-1">
            <button
              type="button"
              className={btn}
              disabled={uploading || generating}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? "上傳中…" : "上載相片"}
            </button>
            <button
              type="button"
              className={`${btn} border-blue-300 text-blue-600 hover:bg-blue-50`}
              disabled={uploading || generating}
              onClick={onGenerate}
              title="用 AI 生成菜式相片（白色背景）"
            >
              {generating ? "生成中…" : "AI 生成"}
            </button>
          </div>
          {imageUrl && (
            <button
              type="button"
              className="text-xs text-slate-400 underline hover:text-red-500"
              onClick={() =>
                setValue(`items.${index}.imageUrl`, "", { shouldDirty: true })
              }
            >
              清除相片
            </button>
          )}
        </div>

        {/* 欄位區 */}
        <div className="flex min-w-0 grow flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              菜式名稱
            </label>
            <input
              type="text"
              placeholder="例如：招牌菠蘿油"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              {...register(`items.${index}.name`)}
            />
            {itemErrors?.name && (
              <p className="mt-1 text-xs text-red-600">
                {itemErrors.name.message}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              價錢（港幣）
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-40"
              {...register(`items.${index}.price`, { valueAsNumber: true })}
            />
            {itemErrors?.price && (
              <p className="mt-1 text-xs text-red-600">
                {itemErrors.price.message}
              </p>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-red-600">{uploadError}</p>
          )}
        </div>

        {/* 排序／移除 */}
        <div className="flex shrink-0 flex-row items-start gap-1 sm:flex-col">
          <button
            type="button"
            className={btn}
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="上移"
          >
            ↑ 上移
          </button>
          <button
            type="button"
            className={btn}
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="下移"
          >
            ↓ 下移
          </button>
          <button
            type="button"
            className={`${btn} border-red-200 text-red-500 hover:bg-red-50`}
            disabled={!canRemove}
            onClick={onRemove}
            aria-label="移除菜式"
          >
            ✕ 移除
          </button>
        </div>
      </div>
    </div>
  );
}
