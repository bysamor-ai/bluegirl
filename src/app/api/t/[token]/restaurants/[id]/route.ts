import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { notFoundResponse, resolveTenant, serverErrorResponse } from "@/lib/tenant/api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string; id: string }> };

// 跨租戶一律 404（唔用 403，免得確認咗個 id 存在）。

/** GET /api/t/[token]/restaurants/[id] — 載入單筆記錄（含菜式，順 sort_order） */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;
    const { id } = await context.params;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, theme, created_at, menu_items(*)")
      .eq("id", id)
      .eq("client_id", tenant.id)
      .order("sort_order", { referencedTable: "menu_items", ascending: true })
      .maybeSingle();
    if (error) {
      // 非 uuid 格式嘅 id 會令 Postgres 報 22P02：呢種係「搵唔到」，唔係故障
      if (error.code === "22P02") return notFoundResponse();
      throw error;
    }
    if (!data) return notFoundResponse();

    return NextResponse.json({ restaurant: data });
  } catch (e) {
    return serverErrorResponse("GET restaurant", e);
  }
}

/** DELETE /api/t/[token]/restaurants/[id] — 刪除記錄（菜式會 cascade 刪除） */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;
    const { id } = await context.params;

    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("restaurants")
      .delete()
      .eq("id", id)
      .eq("client_id", tenant.id)
      .select("id");
    if (error) {
      if (error.code === "22P02") return notFoundResponse();
      throw error;
    }
    if (!data || data.length === 0) return notFoundResponse();

    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverErrorResponse("DELETE restaurant", e);
  }
}
