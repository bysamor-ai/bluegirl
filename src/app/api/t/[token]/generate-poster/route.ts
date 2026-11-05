import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { generatePosterSchema } from "@/lib/schemas";
import { getBackground } from "@/lib/backgrounds";
import { getPosterStyle, randomPosterStyle } from "@/lib/posterStyles";
import { formatHKD } from "@/lib/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { notFoundResponse, resolveTenant, serverErrorResponse } from "@/lib/tenant/api";
import { resolveOwnedTargets } from "@/lib/tenant/ownership";

export const dynamic = "force-dynamic";
// 海報生成成日超過 60 秒；Fluid Compute 下 Hobby plan 都支援到 300 秒
export const maxDuration = 300;

const DEFAULT_POSTER_MODEL = "openai/gpt-image-2/edit";
// 除背景外最多附帶嘅菜式相數量（避免 image_urls 過長）
const MAX_DISH_IMAGES = 8;

type RouteContext = { params: Promise<{ token: string }> };

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

// 注意：getSupabaseServerClient 用 service role，繞過 RLS。
// restaurantId 係呼叫者傳入嘅，一定要先經 resolveOwnedTargets 確認屬於本租戶。

/**
 * POST /api/t/[token]/generate-poster
 * 用使用者揀選嘅品牌背景做底，交俾 gpt-image-2/edit
 * 合成完整餐牌海報（餐廳名 + 菜式 + 價錢 + 已上載嘅菜式相）。
 * FAL_KEY 只存在於伺服器環境變數。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
    }

    // 唔回 zod 原始訊息（預設英文，亦會帶出內部欄位名）
    const parsed = generatePosterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "提交嘅資料格式不正確" }, { status: 400 });
    }

    const { restaurantName, backgroundId, styleId, restaurantId, items } = parsed.data;

    // 背景要係本租戶白名單內；唔係就當搵唔到（租戶 A 唔可以用租戶 B 嘅背景）
    if (!tenant.backgrounds.includes(backgroundId)) return notFoundResponse();

    // 喺花錢叫 fal 之前先驗證擁有權：跨租戶資源一律 404
    const supabase = getSupabaseServerClient();
    const owned = await resolveOwnedTargets(supabase, tenant.id, { restaurantId });
    if (!owned.ok) return notFoundResponse();

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("未設定 FAL_KEY 環境變數");

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
      `Image 1 is the official brand poster background template — use it as the EXACT ` +
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

    let imageUrl: string | undefined;
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
      imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    } catch (e) {
      console.error("[api] 海報生成失敗", e);
      return NextResponse.json({ error: "海報生成失敗，請稍後再試" }, { status: 502 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "冇生成到海報，請稍後再試" }, { status: 502 });
    }

    // 記錄生成 metadata（best-effort）
    try {
      const { error } = await supabase.from("generated_images").insert({
        restaurant_id: owned.restaurantId,
        menu_item_id: null,
        prompt,
        image_url: imageUrl,
        provider: "fal.ai",
      });
      if (error) throw error;
    } catch (e) {
      console.warn("儲存 generated_images 記錄失敗：", e);
    }

    return NextResponse.json({ imageUrl, prompt, provider: "fal.ai", model });
  } catch (e) {
    return serverErrorResponse("POST generate-poster", e);
  }
}
