"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 瀏覽器端 Supabase client（anon key 屬公開設計，配合 RLS 使用）。
 * 用於：讀取記錄、直接上傳食物相片去 Storage。
 */

let browserClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error("未設定 Supabase 環境變數，請檢查 .env.local");
  }
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}

export const FOOD_IMAGES_BUCKET = "food-images";

/** 上傳食物相片去 Supabase Storage，回傳公開 URL */
export async function uploadFoodImage(file: File): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(FOOD_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw new Error(`上傳失敗：${error.message}`);
  }

  const { data } = supabase.storage.from(FOOD_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
