import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { generatePosterSchema } from "@/lib/schemas";
import { getBackground } from "@/lib/backgrounds";
import { getPosterStyle, randomPosterStyle } from "@/lib/posterStyles";
import { formatHKD } from "@/lib/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// 海報生成成日超過 60 秒；Fluid Compute 下 Hobby plan 都支援到 300 秒
export const maxDuration = 300;

const DEFAULT_POSTER_MODEL = "openai/gpt-image-2/edit";
// 除背景外最多附帶嘅菜式相數量（避免 image_urls 過長）
const MAX_DISH_IMAGES = 8;

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

/**
 * POST /api/generate-poster
 * 用使用者揀選嘅 BLUE GIRL 品牌背景做底，交俾 gpt-image-2/edit
 * 合成完整餐牌海報（餐廳名 + 菜式 + 價錢 + 已上載嘅菜式相）。
 * FAL_KEY 只存在於伺服器環境變數。
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "未設定 FAL_KEY 環境變數，無法生成海報" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
  }

  const parsed = generatePosterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "資料驗證失敗" },
      { status: 400 }
    );
  }

  const { restaurantName, backgroundId, styleId, restaurantId, items } =
    parsed.data;
  const bg = getBackground(backgroundId);
  // 冇指定風格就隨機揀一款（UI 已隱藏風格揀選器）
  const style = styleId ? getPosterStyle(styleId) : randomPosterStyle();
  if (!bg.src) {
    return NextResponse.json(
      { error: "請先揀選一個品牌背景主題" },
      { status: 400 }
    );
  }

  const model = process.env.FAL_POSTER_MODEL || DEFAULT_POSTER_MODEL;

  try {
    fal.config({ credentials: falKey });

    // 由自己個 deployment 讀取背景圖同風格參考圖，上傳去 fal storage
    // （本機 localhost fal 讀唔到，所以唔可以直接俾 URL 佢）
    const origin = new URL(request.url).origin;
    const uploadLocalImage = async (src: string, name: string) => {
      const response = await fetch(`${origin}${src}`);
      if (!response.ok) {
        throw new Error(`讀取 ${src} 失敗（${response.status}）`);
      }
      const buffer = await response.arrayBuffer();
      return fal.storage.upload(
        new File([buffer], name, { type: "image/jpeg" })
      );
    };

    const [bgUrl, styleUrl] = await Promise.all([
      uploadLocalImage(bg.src, "background.jpg"),
      uploadLocalImage(style.src, "style-reference.jpg"),
    ]);

    // 菜式相（已係公開 URL：Supabase Storage / fal.media）
    const dishImages = items
      .map((item) => item.imageUrl)
      .filter((url): url is string => Boolean(url))
      .slice(0, MAX_DISH_IMAGES);

    const menuLines = items
      .map((item) => `- ${item.name} …… ${formatHKD(item.price)}`)
      .join("\n");

    const prompt =
      `Design a professional restaurant menu poster.\n` +
      `Image 1 is the official BLUE GIRL beer poster background template — use it as the EXACT ` +
      `canvas: keep its colors, logos, bottle artwork and bottom brand footer completely unchanged, ` +
      `and design all menu content within its empty area.\n` +
      `Image 2 is a DESIGN STYLE reference only — imitate its layout language, composition, ` +
      `dish presentation (${style.styleHint}), typography feel and price display style, ` +
      `but do NOT copy its text, dishes, logos or colors that clash with the background.\n` +
      `Menu content — restaurant name "${restaurantName}" as the title, then these dishes with prices ` +
      `in clean, readable Traditional Chinese typography:\n${menuLines}\n` +
      (dishImages.length > 0
        ? `The remaining ${dishImages.length} image(s) are the actual dish photos — feature them ` +
          `beautifully plated in the layout next to their matching names. ` +
          `Generate appetizing plated photos for any dish without a photo, matching the same style. `
        : `Generate an appetizing plated photo for each dish in the same presentation style. `) +
      `All text must be legible and accurate. Do not cover the bottom brand footer or the bottle. ` +
      `Do not add any other text or watermark.`;

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        image_urls: [bgUrl, styleUrl, ...dishImages],
        image_size: bg.posterSize,
        // medium 快 high 一倍左右，避免撞 function 時限
        quality: "medium",
        num_images: 1,
      },
    });

    const imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "fal.ai 冇回傳海報，請稍後再試" },
        { status: 502 }
      );
    }

    // 記錄生成 metadata（best-effort）
    try {
      const supabase = getSupabaseServerClient();
      await supabase.from("generated_images").insert({
        restaurant_id: restaurantId ?? null,
        menu_item_id: null,
        prompt,
        image_url: imageUrl,
        provider: "fal.ai",
      });
    } catch (e) {
      console.warn("儲存 generated_images 記錄失敗：", e);
    }

    return NextResponse.json({ imageUrl, prompt, provider: "fal.ai", model });
  } catch (e) {
    console.error("海報生成失敗：", e);
    return NextResponse.json(
      { error: "海報生成失敗，請檢查 FAL_KEY 或稍後再試" },
      { status: 502 }
    );
  }
}
