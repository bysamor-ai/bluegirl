import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { generateImageSchema } from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { notFoundResponse, resolveTenant, serverErrorResponse } from "@/lib/tenant/api";
import { resolveOwnedTargets } from "@/lib/tenant/ownership";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 圖片生成需時，放寬 Vercel function 時限

// 無參考圖：text-to-image 由零生成；有參考圖（上載咗相）：edit 模型執靚張相
const DEFAULT_MODEL = "openai/gpt-image-2";
const DEFAULT_EDIT_MODEL = "openai/gpt-image-2/edit";

type RouteContext = { params: Promise<{ token: string }> };

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

// 注意：getSupabaseServerClient 用 service role，繞過 RLS。
// restaurantId／menuItemId 係呼叫者傳入嘅，一定要先經 resolveOwnedTargets 確認屬於本租戶。

/**
 * POST /api/t/[token]/generate-image
 * 由伺服器呼叫 fal.ai（FAL_KEY 只存在於伺服器環境變數，絕不暴露於客戶端）。
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
    const parsed = generateImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "提交嘅資料格式不正確" }, { status: 400 });
    }

    const { foodName, restaurantName, restaurantId, menuItemId, referenceImageUrl } =
      parsed.data;

    // 喺花錢叫 fal 之前先驗證擁有權：跨租戶資源一律 404
    const supabase = getSupabaseServerClient();
    const owned = await resolveOwnedTargets(supabase, tenant.id, { restaurantId, menuItemId });
    if (!owned.ok) return notFoundResponse();

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("未設定 FAL_KEY 環境變數");

    const model = referenceImageUrl
      ? process.env.FAL_EDIT_MODEL || DEFAULT_EDIT_MODEL
      : process.env.FAL_IMAGE_MODEL || DEFAULT_MODEL;

    // 用英文 prompt 生成質素較穩定，菜式名稱保留原文；
    // 所有菜式圖一律純白背景（方便餐牌排版）
    const prompt = referenceImageUrl
      ? `Turn this photo of "${foodName}" into a professional restaurant menu photo: ` +
        `appetizing close-up on a clean plate, isolated on a pure white background (#ffffff), ` +
        `soft studio lighting, keep the dish itself unchanged, no text or watermark.`
      : `Professional food photography of "${foodName}", a dish served at a Hong Kong restaurant` +
        (restaurantName ? ` called "${restaurantName}"` : "") +
        `. Appetizing close-up on a clean plate, isolated on a pure white background (#ffffff), ` +
        `soft studio lighting, restaurant menu style photo, no shadows on the background edges, ` +
        `no text or watermark.`;

    let imageUrl: string | undefined;
    try {
      fal.config({ credentials: falKey });

      // 只傳各 GPT Image 模型都通用嘅參數（image_size enum 每個模型唔同，留 auto）
      const result = await fal.subscribe(model, {
        input: {
          prompt,
          quality: "medium",
          num_images: 1,
          ...(referenceImageUrl ? { image_urls: [referenceImageUrl] } : {}),
        },
      });
      imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    } catch (e) {
      console.error("[api] fal.ai 生成失敗", e);
      return NextResponse.json(
        { error: "圖片生成失敗，請稍後再試" },
        { status: 502 }
      );
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "冇生成到圖片，請稍後再試" }, { status: 502 });
    }

    // 記錄生成 metadata（best-effort：寫入失敗唔阻礙生成結果）
    try {
      const { error } = await supabase.from("generated_images").insert({
        restaurant_id: owned.restaurantId,
        menu_item_id: owned.menuItemId,
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
    return serverErrorResponse("POST generate-image", e);
  }
}
