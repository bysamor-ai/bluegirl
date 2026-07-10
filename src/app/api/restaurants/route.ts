import { NextRequest, NextResponse } from "next/server";
import { restaurantFormSchema } from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** GET /api/restaurants — 載入所有測試記錄 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, theme, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `讀取記錄失敗：${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ restaurants: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}

/** POST /api/restaurants — 儲存（新增或更新）餐廳及菜式 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
  }

  const parsed = restaurantFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "資料驗證失敗" },
      { status: 400 }
    );
  }

  try {
    const supabase = getSupabaseServerClient();
    const { id, name, theme, items } = parsed.data;
    let restaurantId = id;

    if (restaurantId) {
      // 更新現有記錄
      const { error } = await supabase
        .from("restaurants")
        .update({ name, theme })
        .eq("id", restaurantId);
      if (error) throw new Error(`更新餐廳失敗：${error.message}`);

      // 測試設定：整批重寫菜式，簡單可靠
      const { error: delError } = await supabase
        .from("menu_items")
        .delete()
        .eq("restaurant_id", restaurantId);
      if (delError) throw new Error(`更新菜式失敗：${delError.message}`);
    } else {
      const { data, error } = await supabase
        .from("restaurants")
        .insert({ name, theme })
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`儲存餐廳失敗：${error?.message ?? "未知錯誤"}`);
      }
      restaurantId = data.id;
    }

    const rows = items.map((item, index) => ({
      restaurant_id: restaurantId,
      name: item.name,
      price: item.price,
      image_url: item.imageUrl || null,
      sort_order: index,
    }));

    const { error: itemsError } = await supabase.from("menu_items").insert(rows);
    if (itemsError) throw new Error(`儲存菜式失敗：${itemsError.message}`);

    return NextResponse.json({ id: restaurantId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}
