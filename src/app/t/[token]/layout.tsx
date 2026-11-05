import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { brandMark, safeBrandColor } from "@/lib/tenant/brand";
import {
  getTenantFromParams,
  type TenantRouteParams,
} from "@/lib/tenant/params";
import {
  tenantBasePath,
  tenantNewEditorPath,
  tenantWallStickerPath,
} from "@/lib/tenant/paths";

export async function generateMetadata({
  params,
}: {
  params: Promise<TenantRouteParams>;
}): Promise<Metadata> {
  const tenant = await getTenantFromParams(params);
  return { title: { default: tenant.name, template: `%s｜${tenant.name}` } };
}

/**
 * 租戶白牌外殼：logo／名稱／主色全部跟租戶。
 * 主色經 CSS 變數 `--brand` 落去（globals.css 對應 `bg-brand` 等 utility）。
 *
 * 注意：呢度只將 name／logo／顏色嘅「字串」交俾頁首，唔會將成個 tenant 物件
 * 傳落去任何 client component（否則 token／內部 id 會序列化入 RSC payload）。
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<TenantRouteParams>;
}) {
  // 查唔到 → 404；資料庫故障 → 拋上 error boundary（唔好 catch）
  const tenant = await getTenantFromParams(params);
  const home = tenantBasePath(tenant.token);
  const newEditor = tenantNewEditorPath(tenant.token);
  const wallSticker = tenantWallStickerPath(tenant.token);
  const mark = brandMark(tenant);

  return (
    <div
      style={{ "--brand": safeBrandColor(tenant.primaryColor) } as CSSProperties}
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href={home} className="flex min-w-0 items-center gap-2">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-8 w-auto max-w-[8rem] shrink-0 object-contain"
              />
            ) : (
              <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-brand px-1.5 text-sm font-bold text-white">
                {mark}
              </span>
            )}
            <span className="truncate text-base font-semibold tracking-tight sm:text-lg">
              {tenant.name}
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-3 text-sm sm:gap-4">
            <Link
              href={home}
              className="whitespace-nowrap text-slate-600 hover:text-slate-900"
            >
              記錄
            </Link>
            <Link
              href={wallSticker}
              className="whitespace-nowrap text-slate-600 hover:text-slate-900"
            >
              牆貼報價
            </Link>
            <Link
              href={newEditor}
              className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 font-medium text-white hover:brightness-90"
            >
              <span className="hidden sm:inline">建立</span>新餐牌
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
