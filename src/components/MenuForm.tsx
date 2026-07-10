"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useFormContext } from "react-hook-form";
import type { RestaurantFormValues } from "@/lib/schemas";
import { themes, themeIds } from "@/lib/themes";
import { backgrounds, backgroundIds } from "@/lib/backgrounds";
import MenuItemRow from "./MenuItemRow";

/** 主表單：餐廳資料 + 動態菜式列表 + 生成圖片 + 儲存 */
export default function MenuForm() {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<RestaurantFormValues>();

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  /** 為單一菜式生成圖片（經伺服器 route 呼叫 fal.ai） */
  async function generateForIndex(index: number): Promise<boolean> {
    const item = getValues(`items.${index}`);
    if (!item.name.trim()) {
      setGenerateError(`第 ${index + 1} 項未有菜式名稱，無法生成圖片`);
      return false;
    }

    setGenerateError(null);
    setGeneratingIndex(index);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodName: item.name,
          restaurantName: getValues("name") || undefined,
          restaurantId: getValues("id") || undefined,
          menuItemId: item.id || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "圖片生成失敗");
      }
      setValue(`items.${index}.imageUrl`, data.imageUrl, {
        shouldDirty: true,
      });
      return true;
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "圖片生成失敗");
      return false;
    } finally {
      setGeneratingIndex(null);
    }
  }

  /** 一鍵為所有缺圖菜式生成圖片 */
  async function generateMissingImages() {
    const items = getValues("items");
    const missing = items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.imageUrl && item.name.trim());

    if (missing.length === 0) {
      setGenerateError("所有已命名嘅菜式都有圖片，毋須生成");
      return;
    }

    setBatchGenerating(true);
    try {
      for (const { index } of missing) {
        const ok = await generateForIndex(index);
        if (!ok) break; // 出錯即停，避免連環失敗
      }
    } finally {
      setBatchGenerating(false);
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/restaurants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "儲存失敗");
      }
      // 儲存成功即刻轉去展示頁（optimistic 導航）
      router.push(`/menu/${data.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "儲存失敗");
      setSaving(false);
    }
  });

  const busy = saving || batchGenerating || generatingIndex !== null;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* 餐廳資料 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">餐廳資料</h2>
        <label className="mb-1 block text-xs font-medium text-slate-500">
          餐廳名稱
        </label>
        <input
          type="text"
          placeholder="例如：藍妹茶餐廳"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          {...register("name")}
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}

        <p className="mt-4 mb-2 text-xs font-medium text-slate-500">選擇主題</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {themeIds.map((id) => {
            const t = themes[id];
            return (
              <label
                key={id}
                className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-slate-200 p-2.5 text-sm has-checked:border-blue-500 has-checked:ring-2 has-checked:ring-blue-200"
              >
                <input
                  type="radio"
                  value={id}
                  className="sr-only"
                  {...register("theme")}
                />
                <span className={`h-6 w-full rounded ${t.swatch}`} />
                <span className="font-medium">{t.label}</span>
              </label>
            );
          })}
        </div>
        {errors.theme && (
          <p className="mt-1 text-xs text-red-600">{errors.theme.message}</p>
        )}
      </section>

      {/* 菜式列表 */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">
            菜式（{fields.length} 項）
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={generateMissingImages}
              className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {batchGenerating ? "生成緊圖片…" : "✨ 一鍵生成缺圖"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => append({ name: "", price: 0, imageUrl: "" })}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              ＋ 新增菜式
            </button>
          </div>
        </div>

        {errors.items?.root && (
          <p className="text-xs text-red-600">{errors.items.root.message}</p>
        )}
        {typeof errors.items?.message === "string" && (
          <p className="text-xs text-red-600">{errors.items.message}</p>
        )}
        {generateError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {generateError}
          </p>
        )}

        {fields.map((field, index) => (
          <MenuItemRow
            key={field.id}
            index={index}
            total={fields.length}
            generating={generatingIndex === index}
            canRemove={fields.length > 1}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
            onRemove={() => remove(index)}
            onGenerate={() => generateForIndex(index)}
          />
        ))}
      </section>

      {/* 背景主題（BLUE GIRL 品牌底圖） */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="mb-1 text-base font-semibold">背景主題</h2>
        <p className="mb-3 text-xs text-slate-400">
          揀選 BLUE GIRL 品牌底圖後，餐牌會轉用品牌版面；揀「無背景」則用返上面嘅主題色
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {backgroundIds.map((id) => {
            const bg = backgrounds[id];
            return (
              <label
                key={id}
                className="flex cursor-pointer flex-col gap-1.5 rounded-lg border border-slate-200 p-2 text-xs has-checked:border-blue-500 has-checked:ring-2 has-checked:ring-blue-200"
              >
                <input
                  type="radio"
                  value={id}
                  className="sr-only"
                  {...register("background")}
                />
                {bg.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={bg.src}
                    alt={bg.label}
                    className="h-16 w-full rounded object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-full items-center justify-center rounded bg-slate-100 text-slate-400">
                    無背景
                  </span>
                )}
                <span className="font-medium">{bg.label}</span>
              </label>
            );
          })}
        </div>
        {errors.background && (
          <p className="mt-1 text-xs text-red-600">
            {errors.background.message}
          </p>
        )}
      </section>

      {/* 儲存 */}
      <section className="flex flex-col gap-2">
        {saveError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "儲存中…" : "儲存餐牌"}
        </button>
        <p className="text-center text-xs text-slate-400">
          儲存後會自動開啟餐牌展示頁
        </p>
      </section>
    </form>
  );
}
