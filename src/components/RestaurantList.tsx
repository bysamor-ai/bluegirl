"use client";

import { useState } from "react";
import Link from "next/link";
import type { RestaurantRow } from "@/lib/types";
import { getTheme } from "@/lib/themes";
import { formatDate } from "@/lib/format";

/** 已儲存記錄清單（客戶端處理刪除，optimistic 移除） */
export default function RestaurantList({
  restaurants,
}: {
  restaurants: RestaurantRow[];
}) {
  const [rows, setRows] = useState(restaurants);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!window.confirm("確定要刪除呢筆記錄？菜式資料會一併刪除。")) return;

    // Optimistic：先由清單移除，失敗再還原
    const previous = rows;
    setRows(rows.filter((row) => row.id !== id));
    setDeletingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/restaurants/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "刪除失敗");
      }
    } catch (e) {
      setRows(previous);
      setError(e instanceof Error ? e.message : "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-3xl">🍜</p>
        <p className="mt-2 font-medium text-slate-600">未有任何餐牌記錄</p>
        <p className="mt-1 text-sm text-slate-400">
          撳「建立新餐牌」開始你嘅第一份餐牌
        </p>
        <Link
          href="/editor"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          建立新餐牌
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {rows.map((row) => {
        const theme = getTheme(row.theme);
        return (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center"
          >
            {row.poster_url ? (
              // 有最終海報 → 顯示海報縮圖
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.poster_url}
                alt={`${row.name} 海報縮圖`}
                className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover object-top"
              />
            ) : (
              <span
                className={`h-8 w-8 shrink-0 rounded-lg ${theme.swatch}`}
              />
            )}
            <div className="min-w-0 grow">
              <p className="truncate font-semibold">{row.name}</p>
              <p className="text-xs text-slate-400">
                {row.poster_url ? "已有 AI 海報・" : ""}建立於{" "}
                {formatDate(row.created_at)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2 text-sm">
              <Link
                href={`/menu/${row.id}`}
                className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-700"
              >
                展示
              </Link>
              <Link
                href={`/editor/${row.id}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50"
              >
                編輯
              </Link>
              <button
                type="button"
                disabled={deletingId === row.id}
                onClick={() => handleDelete(row.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                刪除
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
