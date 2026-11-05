"use client";

import {
  RATE_PER_SQM,
  formatArea,
  formatHkd,
  type Quote,
} from "@/lib/wall-sticker/pricing";

/** 報價卡：面積、單價、生產價 */
export default function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">面積</dt>
          <dd className="font-medium tabular-nums" data-testid="area">
            {formatArea(quote.areaSqm)}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">生產單價</dt>
          <dd className="font-medium tabular-nums">
            {formatHkd(RATE_PER_SQM)} / m²
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-slate-700">生產價</span>
          <span
            className="text-2xl font-bold tabular-nums text-blue-700"
            data-testid="price"
          >
            {formatHkd(quote.priceHkd)}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          估算價 — 每平方米 HK${RATE_PER_SQM.toLocaleString("en-HK")}
          ，四捨五入到最接近嘅 HK$1。最終報價或會因材料同安裝而有出入。
        </p>
      </div>
    </div>
  );
}
