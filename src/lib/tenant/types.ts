import type { BackgroundId } from "@/lib/backgrounds";

/** public.clients 表嘅原始資料列（欄位逐項對應） */
export interface ClientRow {
  id: string;
  token: string;
  name: string;
  logo_text: string | null;
  logo_url: string | null;
  primary_color: string;
  backgrounds: string[];
  /** 可唔可以喺 AI 生成嘅素材出品牌標誌（預設 false） */
  allow_brand_marks: boolean;
  /** allow_brand_marks = true 時拼落 AI prompt 嘅品牌描述 */
  brand_prompt: string | null;
  created_at: string;
}

/** 應用層使用嘅租戶（camelCase，backgrounds 已用白名單過濾） */
export interface Tenant {
  id: string;
  token: string;
  name: string;
  logoText: string | null;
  logoUrl: string | null;
  primaryColor: string;
  backgrounds: BackgroundId[];
  /**
   * 可唔可以喺 AI 生成嘅素材出品牌標誌。
   * 刻意唔用 `backgrounds.length > 0` 推導：「有冇海報底圖」同
   * 「可唔可以出品牌標誌」係兩件唔同嘅事，白牌客戶攞到自己底圖嗰日
   * 唔應該順手解鎖品牌標誌。
   */
  allowBrandMarks: boolean;
  /** allowBrandMarks 為 true 時拼落 AI prompt 嘅品牌描述；冇設定就 null */
  brandPrompt: string | null;
}
