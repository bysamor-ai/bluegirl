import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/restaurants/[id] — 載入單筆記錄（含菜式，順 sort_order） */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, theme, created_at, menu_items(*)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "menu_items", ascending: true })
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "搵唔到呢筆記錄" }, { status: 404 });
    }
    return NextResponse.json({ restaurant: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}

/** DELETE /api/restaurants/[id] — 刪除記錄（菜式會 cascade 刪除） */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.from("restaurants").delete().eq("id", id);
    if (error) {
      return NextResponse.json(
        { error: `刪除失敗：${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "伺服器錯誤" },
      { status: 500 }
    );
  }
}
