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
}
