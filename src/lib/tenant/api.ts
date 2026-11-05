// API route 專用嘅租戶解析。頁面用 ./params 嘅 getTenantFromParams（會 notFound()），
// 唔適合 route handler，所以呢度提供回 JSON 嘅等價版本。
import "server-only";

import { NextResponse } from "next/server";
import { getTenantByToken } from "./resolve";
import type { Tenant } from "./types";

export const NOT_FOUND_MESSAGE = "搵唔到";
export const SERVER_ERROR_MESSAGE = "伺服器發生錯誤，請稍後再試";

export function notFoundResponse() {
  return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
}

/**
 * 對外一律回通用訊息；詳情只寫 server log，
 * 避免將環境變數名、SQL 錯誤等內部細節回畀瀏覽器。
 */
export function serverErrorResponse(context: string, error: unknown) {
  console.error(`[api] ${context}`, error);
  return NextResponse.json({ error: SERVER_ERROR_MESSAGE }, { status: 500 });
}

/**
 * 由 route params 解析租戶。
 * - token 非 string（runtime 可以係 string[] / undefined）→ 404
 * - 查唔到租戶 → 404
 * - DB 故障 → 例外照拋，由 caller 轉 500（唔可以吞咗變 404）
 */
export async function resolveTenant(
  params: Promise<unknown>
): Promise<{ tenant: Tenant } | { response: NextResponse }> {
  const { token } = ((await params) ?? {}) as { token?: unknown };
  if (typeof token !== "string") return { response: notFoundResponse() };

  const tenant = await getTenantByToken(token);
  if (!tenant) return { response: notFoundResponse() };
  return { tenant };
}
