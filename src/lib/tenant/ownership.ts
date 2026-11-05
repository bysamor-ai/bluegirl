// service role 繞過 RLS，所以任何由呼叫者傳入嘅 restaurantId／menuItemId
// 在使用前都要經呢度確認屬於當前租戶。
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type OwnedTargets =
  | { ok: true; restaurantId: string | null; menuItemId: string | null }
  | { ok: false };

/**
 * 驗證 restaurantId／menuItemId 屬於 `tenantId`。
 * - 唔屬於（或唔存在）→ `{ ok: false }`，caller 回 404（唔用 403，免得洩露存在與否）
 * - DB 故障 → 例外照拋（唔可以吞咗變 404）
 * - 兩個都有時，menuItem 必須屬於該 restaurant
 * - 只有 menuItemId 時，restaurantId 取自（已驗證）嘅 parent
 */
export async function resolveOwnedTargets(
  supabase: SupabaseClient,
  tenantId: string,
  input: { restaurantId?: string; menuItemId?: string }
): Promise<OwnedTargets> {
  let restaurantId = input.restaurantId ?? null;
  const menuItemId = input.menuItemId ?? null;

  if (menuItemId) {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, restaurant_id")
      .eq("id", menuItemId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false };
    if (restaurantId && data.restaurant_id !== restaurantId) return { ok: false };
    restaurantId = data.restaurant_id as string;
  }

  if (restaurantId) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", restaurantId)
      .eq("client_id", tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false };
  }

  return { ok: true, restaurantId, menuItemId };
}
