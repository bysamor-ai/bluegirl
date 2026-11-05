"use client";

import StatusCard from "./StatusCard";

/** error.tsx 共用內容：唔顯示 error.message（可能帶資料庫／環境變數細節） */
export default function ErrorBoundaryView({ reset }: { reset: () => void }) {
  return (
    <StatusCard
      title="系統暫時出現問題"
      message="請稍後再試。如果持續出現，請聯絡同你對接嘅同事。"
    >
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
      >
        重試
      </button>
    </StatusCard>
  );
}
