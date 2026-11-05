/** 錯誤／搵唔到頁面共用嘅中性卡片（繁中，唔透露任何基建或品牌資料） */
export default function StatusCard({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-xl items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{message}</p>
        {children}
      </div>
    </div>
  );
}
