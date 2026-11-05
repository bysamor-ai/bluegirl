import type { Metadata } from "next";
import WallStickerStudio from "@/components/wall-sticker/WallStickerStudio";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "牆貼報價",
  description: "現場影相、框位、入尺寸，即出生產報價同實景效果圖",
};

/** /t/[token]/wall-sticker — 前線同事現場用嘅牆貼報價 + mockup 工具 */
export default async function WallStickerPage({
  params,
}: {
  params: Promise<TenantRouteParams>;
}) {
  // 工具本身唔查資料庫，但都要確認 token 有效，唔可以俾人用亂 token 入到工具
  const tenant = await getTenantFromParams(params);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-600">
          {tenant.name} · 現場工具
        </p>
        <h1 className="mt-1 text-xl font-bold">牆貼報價同實景效果圖</h1>
        <p className="mt-1 text-sm text-slate-500">
          喺商戶度影低要貼嘅位置，框出範圍再入闊高，即刻有生產報價同貼落現場嘅效果圖。
        </p>
      </header>
      <WallStickerStudio />
    </div>
  );
}
