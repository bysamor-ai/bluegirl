import Link from "next/link";
import { notFound } from "next/navigation";
import MenuPreview from "@/components/MenuPreview";
import PrintButton from "@/components/PrintButton";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";
import { tenantBasePath, tenantEditorPath } from "@/lib/tenant/paths";
import type { RestaurantWithItems } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "餐牌展示" };

/** 最終餐牌展示頁 — 適合餐廳presentation／列印 */
export default async function MenuPage({
  params,
}: {
  params: Promise<TenantRouteParams & { id: string }>;
}) {
  // 刻意唔包 try/catch：資料庫故障嘅例外要浮上 error boundary，唔可以變成 404
  const tenant = await getTenantFromParams(params);
  const { id } = await params;
  const base = tenantBasePath(tenant.token);

  // 只有「查詢成功但零筆」先係 404；資料庫錯誤要拋上 error boundary（同 getTenantFromParams 一致）
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("restaurants")
    .select("id, name, theme, background, poster_url, created_at, menu_items(*)")
    .eq("id", id)
    // service role 繞過 RLS，租戶隔離完全靠呢句
    .eq("client_id", tenant.id)
    .order("sort_order", { referencedTable: "menu_items", ascending: true })
    .maybeSingle();

  // id 唔係合法 uuid（亂入網址）係用戶輸入錯，屬 404；其餘錯誤先係故障
  if (error && error.code === "22P02") notFound();
  if (error) {
    throw new Error(`讀取餐牌失敗：${error.message}`);
  }
  if (!data) notFound();
  const restaurant = data as RestaurantWithItems;

  const items = restaurant.menu_items.map((item) => ({
    name: item.name,
    price: Number(item.price),
    imageUrl: item.image_url ?? undefined,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={base} className="text-sm text-slate-500 hover:text-slate-900">
          ← 返回記錄
        </Link>
        <div className="flex gap-2">
          <Link
            href={tenantEditorPath(tenant.token, restaurant.id)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ✏️ 編輯
          </Link>
          <PrintButton />
        </div>
      </div>

      {restaurant.poster_url ? (
        // 有 AI 生成嘅最終海報 → 直接展示張海報
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={restaurant.poster_url}
          alt={`${restaurant.name} 餐牌海報`}
          className="w-full rounded-xl border border-slate-200 shadow-sm"
        />
      ) : (
        <MenuPreview
          name={restaurant.name}
          theme={restaurant.theme}
          background={restaurant.background ?? "none"}
          items={items}
        />
      )}
    </div>
  );
}
