import { NextRequest, NextResponse } from "next/server";
import { restaurantFormSchema } from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { notFoundResponse, resolveTenant, serverErrorResponse } from "@/lib/tenant/api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// 注意：getSupabaseServerClient 用 service role，繞過 RLS。
// 租戶隔離完全靠下面每個查詢自己帶 client_id。

/** GET /api/t/[token]/restaurants — 只載入該租戶嘅記錄 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, theme, background, poster_url, created_at")
      .eq("client_id", tenant.id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ restaurants: data ?? [] });
  } catch (e) {
    return serverErrorResponse("GET restaurants", e);
  }
}

/** POST /api/t/[token]/restaurants — 儲存（新增或更新）餐廳及菜式 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
    }

    // zod object 預設會剝走未知欄位（包括夾帶嘅 client_id）；
    // client_id 只會用 tenant.id，永不讀 body。
    const parsed = restaurantFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "資料驗證失敗" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const { id, name, theme, background, posterUrl, items } = parsed.data;
    let restaurantId = id;

    if (restaurantId) {
      // 更新：條件同時帶 id + client_id，並要求真係更新到一行。
      // 唔屬於該租戶（或唔存在）就 404，而且喺呢步之前唔會碰 menu_items。
      // 更新內容刻意唔包括 client_id，記錄唔會被搬去第二個租戶。
      const { data: updated, error } = await supabase
        .from("restaurants")
        .update({ name, theme, background, poster_url: posterUrl || null })
        .eq("id", restaurantId)
        .eq("client_id", tenant.id)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) return notFoundResponse();

      // 測試設定：整批重寫菜式（已確認 parent 屬於該租戶）
      const { error: delError } = await supabase
        .from("menu_items")
        .delete()
        .eq("restaurant_id", restaurantId);
      if (delError) throw delError;
    } else {
      const { data, error } = await supabase
        .from("restaurants")
        .insert({
          name,
          theme,
          background,
          poster_url: posterUrl || null,
          client_id: tenant.id,
        })
        .select("id")
        .single();
      if (error || !data) throw error ?? new Error("insert 冇回傳 id");
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
    if (itemsError) throw itemsError;

    return NextResponse.json({ id: restaurantId });
  } catch (e) {
    return serverErrorResponse("POST restaurants", e);
  }
}
