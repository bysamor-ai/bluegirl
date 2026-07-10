"use client";

/** 列印／儲存 PDF 按鈕（展示頁用） */
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
    >
      🖨️ 列印餐牌
    </button>
  );
}
