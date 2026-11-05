import Link from "next/link";
import type { TenantRouteParams } from "@/lib/tenant/params";
import {
  tenantBasePath,
  tenantNewEditorPath,
  tenantWallStickerPath,
} from "@/lib/tenant/paths";

/**
 * 租戶區嘅最小 layout —— 由舊 root layout 搬落嚟嘅頁首，外觀維持原狀，
 * 只係導覽連結改成帶 token。品牌白牌化（logo／主色／租戶名）係 Task 7 嘅範圍，
 * 所以呢度**冇**查租戶，亦**冇**用 tenant 嘅資料，淨係用 token 砌連結。
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<TenantRouteParams>;
}) {
  // 呢度唔做驗證：token 唔啱嗰陣由頁面負責 notFound()，
  // layout 淨係需要連結（唔係 string 就退返首頁）。
  const { token } = (await params) as { token?: unknown };
  const links =
    typeof token === "string"
      ? {
          home: tenantBasePath(token),
          newEditor: tenantNewEditorPath(token),
          wallSticker: tenantWallStickerPath(token),
        }
      : { home: "/", newEditor: "/", wallSticker: "/" };

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={links.home} className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              BG
            </span>
            {/* 手機淨顯示品牌名，避免同導覽逼到換行 */}
            <span className="truncate text-base font-semibold tracking-tight sm:text-lg">
              BLUE GIRL
              <span className="hidden sm:inline"> 餐牌生成器</span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
            <Link
              href={links.home}
              className="whitespace-nowrap text-slate-600 hover:text-slate-900"
            >
              記錄
            </Link>
            <Link
              href={links.wallSticker}
              className="whitespace-nowrap text-slate-600 hover:text-slate-900"
            >
              牆貼報價
            </Link>
            <Link
              href={links.newEditor}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              <span className="hidden sm:inline">建立</span>新餐牌
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}
