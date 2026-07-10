/** 港幣格式，例如 HK$68.00 */
const hkd = new Intl.NumberFormat("zh-HK", {
  style: "currency",
  currency: "HKD",
});

export function formatHKD(value: number): string {
  if (!Number.isFinite(value)) return hkd.format(0);
  return hkd.format(value);
}

/** 日期顯示，例如 2026年7月10日 */
export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("zh-HK", { dateStyle: "long" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}
