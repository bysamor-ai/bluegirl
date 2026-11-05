import { notFound } from "next/navigation";
import EditorShell from "@/components/EditorShell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";
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

  let restaurant: RestaurantWithItems | null = null;
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, theme, background, poster_url, created_at, menu_items(*)")
      .eq("id", id)
      // service role 繞過 RLS，租戶隔離完全靠呢句
      .eq("client_id", tenant.id)
      .order("sort_order", { referencedTable: "menu_items", ascending: true })
      .single();
    restaurant = data as RestaurantWithItems | null;
  } catch {
    restaurant = null;
  }

  if (!restaurant) notFound();

  const initial: RestaurantFormValues = {
    id: restaurant.id,
    name: restaurant.name,
    theme: restaurant.theme,
    background: restaurant.background ?? "none",
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

  return <EditorShell initial={initial} token={tenant.token} />;
}
