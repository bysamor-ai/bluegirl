export const metadata = { title: "餐牌生成器" };

/**
 * 公開首頁：刻意保持中性。
 *
 * 唔查資料庫、唔列租戶、唔列 token —— 任何人（包括其他客戶同埋爬蟲）都睇到呢頁，
 * 所以呢度絕對唔可以透露有邊啲客戶或者佢哋條連結。入口一律係 /t/<token>。
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">餐牌生成器</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          請用你收到嘅專屬連結進入。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          搵唔到條連結嘅話，請聯絡同你對接嘅同事重新發送。
        </p>
      </div>
    </div>
  );
}
