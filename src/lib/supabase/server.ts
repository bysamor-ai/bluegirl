import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 伺服器端 Supabase client（route handlers / server components 用）。
 * 測試設定：用 anon key + 寬鬆 RLS 政策，毋須 service role key。
 */
export function getSupabaseServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("未設定 Supabase 環境變數（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY）");
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
