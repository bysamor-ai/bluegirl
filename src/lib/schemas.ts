import { z } from "zod";
import { themeIds } from "./themes";
import { backgroundIds } from "./backgrounds";

/** 單個菜式（表單 + API 共用） */
export const menuItemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "請輸入菜式名稱").max(100, "菜式名稱過長"),
  // 表單以 valueAsNumber 註冊，空值會變 NaN 並觸發 invalid_type_error
  price: z
    .number({ invalid_type_error: "請輸入有效價錢" })
    .min(0, "價錢不可以係負數")
    .max(999999, "價錢過大"),
  imageUrl: z.string().url("圖片網址格式不正確").or(z.literal("")),
});

/** 餐廳 + 餐牌（表單 + 儲存 API 共用） */
export const restaurantFormSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "請輸入餐廳名稱").max(100, "餐廳名稱過長"),
  theme: z.enum(themeIds, { errorMap: () => ({ message: "請選擇主題" }) }),
  background: z.enum(backgroundIds, {
    errorMap: () => ({ message: "請選擇背景主題" }),
  }),
  items: z
    .array(menuItemSchema)
    .min(1, "最少需要一個菜式")
    .max(50, "菜式數量上限為 50"),
});

export type MenuItemFormValues = z.infer<typeof menuItemSchema>;
export type RestaurantFormValues = z.infer<typeof restaurantFormSchema>;

/** 圖片生成 API request body */
export const generateImageSchema = z.object({
  foodName: z.string().min(1, "請先輸入菜式名稱").max(100),
  restaurantName: z.string().max(100).optional(),
  restaurantId: z.string().uuid().optional(),
  menuItemId: z.string().uuid().optional(),
  /** 有參考圖（例如已上載嘅 Supabase Storage 相片）時用 edit 模型執靚佢 */
  referenceImageUrl: z.string().url().optional(),
});

export type GenerateImageInput = z.infer<typeof generateImageSchema>;
