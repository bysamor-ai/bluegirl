/**
 * 主題預設 config — 可直接喺呢度修改／新增主題。
 * MenuPreview 同 /menu/[id] 展示頁都會按呢份 config 渲染。
 */

export const themeIds = ["classic", "minimal", "dark", "promo"] as const;
export type ThemeId = (typeof themeIds)[number];

export interface ThemeConfig {
  id: ThemeId;
  /** zh-HK 顯示名稱 */
  label: string;
  description: string;
  /** 揀選器色塊 */
  swatch: string;
  /** 餐牌最外層容器 */
  card: string;
  /** 餐廳名稱區 */
  header: string;
  headerText: string;
  /** 標題下方裝飾線 */
  divider: string;
  /** 菜式排列方式 */
  itemLayout: "list" | "grid";
  /** 單個菜式容器 */
  itemCard: string;
  itemName: string;
  itemPrice: string;
  /** 圖片外框 */
  imageFrame: string;
  /** 冇圖片時嘅佔位背景 */
  imagePlaceholder: string;
  /** 促銷 badge 文字（只有 promo 主題用） */
  badgeText?: string;
  badgeClass?: string;
  /** 頁尾文字 */
  footerText: string;
  footerClass: string;
}

export const themes: Record<ThemeId, ThemeConfig> = {
  classic: {
    id: "classic",
    label: "經典傳統",
    description: "傳統酒樓餐館風格，米色底、酒紅點綴、襯線字體",
    swatch: "bg-[#8f1d1d]",
    card: "bg-[#fdf8ee] text-[#3d2b1f] rounded-xl border-4 border-double border-[#8f1d1d] p-6 sm:p-10 font-serif",
    header: "text-center pb-4",
    headerText: "text-3xl sm:text-4xl font-bold tracking-widest text-[#8f1d1d]",
    divider: "mx-auto my-4 h-px w-2/3 bg-[#8f1d1d]/40",
    itemLayout: "list",
    itemCard:
      "flex items-center gap-4 border-b border-dashed border-[#8f1d1d]/30 py-4 last:border-0",
    itemName: "text-lg font-semibold",
    itemPrice: "ml-auto text-lg font-bold text-[#8f1d1d] whitespace-nowrap",
    imageFrame:
      "h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-full border-2 border-[#8f1d1d]/50",
    imagePlaceholder: "bg-[#8f1d1d]/10",
    footerText: "歡迎光臨・多謝惠顧",
    footerClass: "pt-6 text-center text-sm tracking-widest text-[#8f1d1d]/70",
  },
  minimal: {
    id: "minimal",
    label: "簡約現代",
    description: "白底黑字、大量留白、無襯線字體嘅現代風格",
    swatch: "bg-slate-900",
    card: "bg-white text-slate-900 rounded-xl border border-slate-200 p-6 sm:p-12",
    header: "pb-6",
    headerText: "text-2xl sm:text-3xl font-light tracking-[0.3em] uppercase",
    divider: "my-4 h-px w-12 bg-slate-900",
    itemLayout: "grid",
    itemCard: "flex flex-col gap-2",
    itemName: "text-sm font-medium tracking-wide",
    itemPrice: "text-sm text-slate-500",
    imageFrame: "aspect-square w-full overflow-hidden rounded-lg",
    imagePlaceholder: "bg-slate-100",
    footerText: "menu",
    footerClass: "pt-8 text-xs uppercase tracking-[0.4em] text-slate-400",
  },
  dark: {
    id: "dark",
    label: "尊貴深色",
    description: "深黑底金色字，高級餐廳質感",
    swatch: "bg-[#111111] ring-1 ring-[#c9a227]",
    card: "bg-[#111111] text-[#e8e3d5] rounded-xl border border-[#c9a227]/60 p-6 sm:p-10",
    header: "text-center pb-4",
    headerText:
      "text-3xl sm:text-4xl font-semibold tracking-[0.2em] text-[#c9a227]",
    divider:
      "mx-auto my-4 h-px w-1/2 bg-gradient-to-r from-transparent via-[#c9a227] to-transparent",
    itemLayout: "grid",
    itemCard:
      "flex flex-col gap-2 rounded-lg border border-[#c9a227]/20 bg-white/5 p-3",
    itemName: "text-base font-medium",
    itemPrice: "text-base font-semibold text-[#c9a227]",
    imageFrame: "aspect-[4/3] w-full overflow-hidden rounded-md",
    imagePlaceholder: "bg-white/10",
    footerText: "FINE DINING",
    footerClass:
      "pt-6 text-center text-xs tracking-[0.5em] text-[#c9a227]/60",
  },
  promo: {
    id: "promo",
    label: "大膽促銷",
    description: "鮮明黃紅配色，適合推廣活動同限時優惠",
    swatch: "bg-gradient-to-br from-yellow-400 to-red-600",
    card: "bg-yellow-300 text-red-900 rounded-xl border-8 border-red-600 p-6 sm:p-10",
    header: "text-center pb-4 -rotate-1",
    headerText:
      "text-4xl sm:text-5xl font-black tracking-tight text-red-600 drop-shadow-[3px_3px_0_rgba(0,0,0,0.2)]",
    divider: "mx-auto my-3 h-2 w-1/3 rounded-full bg-red-600",
    itemLayout: "grid",
    itemCard:
      "flex flex-col gap-2 rounded-xl bg-white p-3 shadow-[4px_4px_0_rgba(185,28,28,0.8)]",
    itemName: "text-base font-extrabold",
    itemPrice:
      "inline-block w-fit rounded-full bg-red-600 px-3 py-0.5 text-base font-black text-yellow-300",
    imageFrame: "aspect-square w-full overflow-hidden rounded-lg",
    imagePlaceholder: "bg-yellow-100",
    badgeText: "限時推廣",
    badgeClass:
      "mx-auto mb-2 w-fit rotate-2 rounded-full bg-red-600 px-4 py-1 text-sm font-black text-white",
    footerText: "★ 立即嚟試 ★",
    footerClass: "pt-6 text-center text-lg font-black text-red-700",
  },
};

export function getTheme(id: string | null | undefined): ThemeConfig {
  return themes[(id as ThemeId) ?? "classic"] ?? themes.classic;
}
