"use client";

import type { LengthUnit } from "@/lib/wall-sticker/pricing";

interface Props {
  width: number;
  height: number;
  unit: LengthUnit;
  onWidthChange: (v: number) => void;
  onHeightChange: (v: number) => void;
  onUnitChange: (u: LengthUnit) => void;
}

const UNITS: Array<{ value: LengthUnit; label: string }> = [
  { value: "m", label: "米 (m)" },
  { value: "cm", label: "厘米 (cm)" },
];

/** 牆貼實際尺寸輸入 */
export default function SpecForm({
  width,
  height,
  unit,
  onWidthChange,
  onHeightChange,
  onUnitChange,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">牆貼尺寸</span>
        <div className="flex rounded-lg border border-slate-300 p-0.5">
          {UNITS.map((u) => (
            <button
              key={u.value}
              type="button"
              onClick={() => onUnitChange(u.value)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                unit === u.value
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">闊</span>
          <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={unit === "cm" ? 1 : 0.05}
              value={Number.isFinite(width) ? width : ""}
              onChange={(e) => onWidthChange(parseFloat(e.target.value))}
              aria-label="牆貼闊度"
              className="w-full rounded-lg bg-transparent px-3 py-2 text-right tabular-nums outline-none"
            />
            <span className="px-3 text-sm text-slate-400">{unit}</span>
          </div>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">高</span>
          <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={unit === "cm" ? 1 : 0.05}
              value={Number.isFinite(height) ? height : ""}
              onChange={(e) => onHeightChange(parseFloat(e.target.value))}
              aria-label="牆貼高度"
              className="w-full rounded-lg bg-transparent px-3 py-2 text-right tabular-nums outline-none"
            />
            <span className="px-3 text-sm text-slate-400">{unit}</span>
          </div>
        </label>
      </div>
    </div>
  );
}
