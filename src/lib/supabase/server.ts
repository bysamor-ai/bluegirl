// SUPABASE_SERVICE_ROLE_KEY 一旦入到 client bundle 就等於公開晒成個資料庫。
// 註解靠唔住，所以用 `server-only` 令誤 import 喺 build 階段即刻爆。
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 伺服器端 Supabase client（route handlers / server components 用）。
 *
 * 使用 service role key，繞過 RLS，因此租戶隔離必須由伺服器端程式碼負責。
 * 重要：
 * - SUPABASE_SERVICE_ROLE_KEY 絕對唔可以加 NEXT_PUBLIC_ 前綴，否則會被打包入瀏覽器。
 * - 搵唔到 key 時一律拋錯，絕對唔可以降級用 anon key（降級會令隔離保護靜靜失效）。
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("未設定環境變數 NEXT_PUBLIC_SUPABASE_URL，伺服器端 Supabase client 無法建立");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "未設定環境變數 SUPABASE_SERVICE_ROLE_KEY（只限伺服器使用，切勿加 NEXT_PUBLIC_ 前綴）；為保護租戶隔離，唔會降級使用 anon key"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
