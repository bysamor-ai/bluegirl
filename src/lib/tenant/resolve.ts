import { backgroundIds, type BackgroundId } from "@/lib/backgrounds";
import { retryOnColdStart } from "@/lib/supabase/cold-start";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientRow, Tenant } from "./types";

const TOKEN_PATTERN = /^[A-Za-z0-9]{12}$/;

/** 剪走前後空白並驗證格式（12 位英數字，分大小寫）。唔啱就回 null。 */
export function normalizeToken(raw: string): string | null {
  const token = raw.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

function isBackgroundId(value: string): value is BackgroundId {
  return (backgroundIds as readonly string[]).includes(value);
}

/** 將資料庫列轉做 Tenant；backgrounds 只保留白名單入面嘅 id */
export function toTenant(row: ClientRow): Tenant {
  return {
    id: row.id,
    token: row.token,
    name: row.name,
    logoText: row.logo_text,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    backgrounds: (row.backgrounds ?? []).filter(isBackgroundId),
  };
}

/**
 * 用 token 查租戶。格式唔啱即刻回 null（唔打 DB）；查唔到回 null；
 * 真正嘅資料庫錯誤（非冷啟動）會拋錯，避免將故障誤當成「冇呢個客戶」。
 */
export async function getTenantByToken(raw: string): Promise<Tenant | null> {
  const token = normalizeToken(raw);
  if (!token) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await retryOnColdStart<ClientRow>(async () =>
    supabase
      .from("clients")
      .select("id, token, name, logo_text, logo_url, primary_color, backgrounds, created_at")
      .eq("token", token)
      .maybeSingle()
  );

  if (error) {
    throw new Error(`租戶查詢失敗：${error.message ?? error.code ?? "未知錯誤"}`);
  }
  return data ? toTenant(data) : null;
}
