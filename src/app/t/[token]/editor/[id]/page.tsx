import { notFound } from "next/navigation";
import EditorShell from "@/components/EditorShell";
import { retryOnColdStart } from "@/lib/supabase/cold-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";
import type { BackgroundId } from "@/lib/backgrounds";
import type { RestaurantWithItems } from "@/lib/types";
import type { RestaurantFormValues } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "編輯餐牌" };

/** 載入現有記錄入編輯器 */
export default async function EditEditorPage({
  params,
}: {
  params: Promise<TenantRouteParams & { id: string }>;
}) {
  // 刻意唔包 try/catch：資料庫故障嘅例外要浮上 error boundary，唔可以變成 404
  const tenant = await getTenantFromParams(params);
  const { id } = await params;

  // 只有「查詢成功但零筆」先係 404；資料庫錯誤要拋上 error boundary（同 getTenantFromParams 一致）
  const supabase = getSupabaseServerClient();
  const { data, error } = await retryOnColdStart<RestaurantWithItems>(async () => {
    const res = await supabase
      .from("restaurants")
      .select("id, name, theme, background, poster_url, created_at, menu_items(*)")
      .eq("id", id)
      // service role 繞過 RLS，租戶隔離完全靠呢句
      .eq("client_id", tenant.id)
      .order("sort_order", { referencedTable: "menu_items", ascending: true })
      .maybeSingle();
    return { data: res.data as RestaurantWithItems | null, error: res.error };
  });

  // id 唔係合法 uuid（亂入網址）係用戶輸入錯，屬 404；其餘錯誤先係故障
  if (error && error.code === "22P02") notFound();
  if (error) {
    throw new Error(`讀取餐牌失敗：${error.message}`);
  }
  if (!data) notFound();
  const restaurant = data;

  const initial: RestaurantFormValues = {
    id: restaurant.id,
    name: restaurant.name,
    theme: restaurant.theme,
    // 記錄嘅背景唔喺租戶可用清單內就當「無背景」
    background: tenant.backgrounds.includes(restaurant.background as BackgroundId)
      ? (restaurant.background as BackgroundId)
      : "none",
    posterUrl: restaurant.poster_url ?? "",
    items: restaurant.menu_items.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      imageUrl: item.image_url ?? "",
    })),
  };

  // 記錄冇菜式時最少提供一行空白列
  if (initial.items.length === 0) {
    initial.items = [{ name: "", price: 0, imageUrl: "" }];
  }

  return <EditorShell
      initial={initial}
      token={tenant.token}
      allowedBackgrounds={tenant.backgrounds}
    />;
}
