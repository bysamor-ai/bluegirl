// 呢個模組會經 ./resolve 行到 service role Supabase client，
// 一旦被 client component import 就會將 service role 嘅程式碼路徑拉落 bundle。
// `server-only` 令呢種 import 喺 build 階段即刻失敗，唔使靠人手 review 把關。
// 純字串嘅 URL helper 喺 ./paths，client 同 server 都用得。
import "server-only";

import { notFound } from "next/navigation";
import { getTenantByToken } from "./resolve";
import type { Tenant } from "./types";

/** `/t/[token]/*` 動態路由嘅 params（Next.js 15 入面係 Promise） */
export type TenantRouteParams = { token: string };

/**
 * 由動態路由 params 攞返租戶，攞唔到就 404。
 *
 * 兩個刻意嘅決定：
 * 1. `params.token` 喺型別上係 string，但 runtime 可以係 string[]（路由改動）或者
 *    undefined，而 `normalizeToken` 收到非 string 會拋 TypeError。所以先確認係 string，
 *    唔係就當「搵唔到」處理。
 * 2. **唔好加 try/catch。** `getTenantByToken` 查唔到會回 null（→ notFound），
 *    但遇到真正嘅資料庫故障會拋例外。例外要浮上 Next.js 嘅 error boundary，
 *    唔可以吞咗變成 404 —— 資料庫掛咗顯示成「搵唔到」會令前線同事以為自己條 link 失效。
 */
export async function getTenantFromParams(
  params: Promise<TenantRouteParams>
): Promise<Tenant> {
  const { token } = (await params) as { token?: unknown };
  if (typeof token !== "string") notFound();

  const tenant = await getTenantByToken(token);
  if (!tenant) notFound();

  return tenant;
}
