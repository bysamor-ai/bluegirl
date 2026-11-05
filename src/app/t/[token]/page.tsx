import Link from "next/link";
import RestaurantList from "@/components/RestaurantList";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isColdStartError, retryOnColdStart } from "@/lib/supabase/cold-start";
import { getTenantFromParams, type TenantRouteParams } from "@/lib/tenant/params";
import { tenantNewEditorPath } from "@/lib/tenant/paths";
import type { RestaurantRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 租戶首頁：載入呢個租戶嘅餐牌記錄 */
export default async function TenantHomePage({
  params,
}: {
  params: Promise<TenantRouteParams>;
}) {
  // 刻意唔包 try/catch：資料庫故障嘅例外要浮上 error boundary，唔可以變成 404
  const tenant = await getTenantFromParams(params);
  const newEditorHref = tenantNewEditorPath(tenant.token);

  let restaurants: RestaurantRow[] = [];
  let loadError: string | null = null;
  // 分開兩種失敗：資料庫瞓緊（等陣就得） vs 真係未設定好（要人手跟進）
  let isWakingUp = false;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await retryOnColdStart<RestaurantRow[]>(async () => {
      const res = await supabase
        .from("restaurants")
        .select("id, name, theme, background, poster_url, created_at")
        // service role 繞過 RLS，租戶隔離完全靠呢句
        .eq("client_id", tenant.id)
        .order("created_at", { ascending: false });
      return { data: res.data as RestaurantRow[] | null, error: res.error };
    });

    if (error) {
      isWakingUp = isColdStartError(error);
      loadError = `讀取記錄失敗：${error.message}`;
    } else {
      restaurants = data ?? [];
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "伺服器錯誤";
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">餐牌記錄</h1>
          <p className="mt-1 text-sm text-slate-500">
            載入以前儲存嘅測試記錄，或者建立新餐牌
          </p>
        </div>
        <Link
          href={newEditorHref}
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-90"
        >
          ＋ 建立新餐牌
        </Link>
      </div>

      {loadError ? (
        isWakingUp ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
            <p className="font-medium text-blue-800">資料庫啟動中⋯</p>
            <p className="mt-1 text-sm text-blue-700">
              個資料庫閒置咗耐會自動休眠，而家啱啱叫醒緊，通常幾秒就好。
              <strong className="font-medium">請重新整理頁面再試一次。</strong>
            </p>
            <p className="mt-3 text-sm text-blue-700">
              （記錄冇遺失，唔使改任何設定 —— 如果重新整理幾次之後都係咁，先至需要跟進。）
            </p>
            <p className="mt-3 text-sm text-blue-700">
              想即刻開工嘅話，編輯器唔需要資料庫都用得 —{" "}
              <Link href={newEditorHref} className="underline">
                立即開啟
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-medium text-amber-800">未能連接資料庫</p>
            <p className="mt-1 text-sm text-amber-700">{loadError}</p>
            <p className="mt-3 text-sm text-amber-700">
              請確認已經：1) 喺 Supabase 執行 <code>supabase/schema.sql</code>；
              2) 喺 <code>.env.local</code>（或 Vercel 環境變數）填好{" "}
              <code>NEXT_PUBLIC_SUPABASE_URL</code> 同{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code>。 詳情請睇 README。
            </p>
            <p className="mt-3 text-sm text-amber-700">
              （編輯器同即時預覽唔需要資料庫都可以試用 —{" "}
              <Link href={newEditorHref} className="underline">
                立即開啟
              </Link>
              ）
            </p>
          </div>
        )
      ) : (
        <RestaurantList restaurants={restaurants} token={tenant.token} />
      )}
    </div>
  );
}
