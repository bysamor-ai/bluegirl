import type { ThemeId } from "./themes";
import type { BackgroundId } from "./backgrounds";

/** Supabase 資料表 row types */

export interface RestaurantRow {
  id: string;
  name: string;
  theme: ThemeId;
  background: BackgroundId;
  created_at: string;
}

export interface MenuItemRow {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface GeneratedImageRow {
  id: string;
  restaurant_id: string | null;
  menu_item_id: string | null;
  prompt: string;
  image_url: string;
  provider: string;
  created_at: string;
}

export interface RestaurantWithItems extends RestaurantRow {
  menu_items: MenuItemRow[];
}
