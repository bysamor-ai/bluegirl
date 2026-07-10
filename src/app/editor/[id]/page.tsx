import { notFound } from "next/navigation";
import EditorShell from "@/components/EditorShell";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RestaurantWithItems } from "@/lib/types";
import type { RestaurantFormValues } from "@/lib/schemas";

export const dynamic = "force-dynamic";
export const metadata = { title: "編輯餐牌 | BLUE GIRL 餐牌生成器" };

/** 載入現有記錄入編輯器 */
export default async function EditEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let restaurant: RestaurantWithItems | null = null;
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, theme, created_at, menu_items(*)")
      .eq("id", id)
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

  return <EditorShell initial={initial} />;
}
