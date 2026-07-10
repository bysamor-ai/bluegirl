import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { generateImageSchema } from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 圖片生成需時，放寬 Vercel function 時限

// 無參考圖：text-to-image 由零生成；有參考圖（上載咗相）：edit 模型執靚張相
const DEFAULT_MODEL = "openai/gpt-image-2";
const DEFAULT_EDIT_MODEL = "openai/gpt-image-2/edit";

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

/**
 * POST /api/generate-image
 * 由伺服器呼叫 fal.ai（FAL_KEY 只存在於伺服器環境變數，絕不暴露於客戶端）。
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "未設定 FAL_KEY 環境變數，無法生成圖片" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
  }

  const parsed = generateImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "資料驗證失敗" },
      { status: 400 }
    );
  }

  const { foodName, restaurantName, restaurantId, menuItemId, referenceImageUrl } =
    parsed.data;

  // 有參考圖（例如 Supabase Storage 公開 URL）→ edit 模型；無 → text-to-image
  const model = referenceImageUrl
    ? process.env.FAL_EDIT_MODEL || DEFAULT_EDIT_MODEL
    : process.env.FAL_IMAGE_MODEL || DEFAULT_MODEL;

  // 用英文 prompt 生成質素較穩定，菜式名稱保留原文
  const prompt = referenceImageUrl
    ? `Turn this photo of "${foodName}" into a professional restaurant menu photo: ` +
      `appetizing close-up on a clean plate, soft natural lighting, clean background, ` +
      `keep the dish itself unchanged, no text or watermark.`
    : `Professional food photography of "${foodName}", a dish served at a Hong Kong restaurant` +
      (restaurantName ? ` called "${restaurantName}"` : "") +
      `. Appetizing close-up on a clean plate, soft natural lighting, ` +
      `shallow depth of field, restaurant menu style photo, no text or watermark.`;

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

    const imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "fal.ai 冇回傳圖片，請稍後再試" },
        { status: 502 }
      );
    }

    // 記錄生成 metadata（best-effort：Supabase 未設定時唔阻礙生成結果）
    try {
      const supabase = getSupabaseServerClient();
      await supabase.from("generated_images").insert({
        restaurant_id: restaurantId ?? null,
        menu_item_id: menuItemId ?? null,
        prompt,
        image_url: imageUrl,
        provider: "fal.ai",
      });
    } catch (e) {
      console.warn("儲存 generated_images 記錄失敗：", e);
    }

    return NextResponse.json({ imageUrl, prompt, provider: "fal.ai", model });
  } catch (e) {
    console.error("fal.ai 生成失敗：", e);
    return NextResponse.json(
      { error: "圖片生成失敗，請檢查 FAL_KEY 或稍後再試" },
      { status: 502 }
    );
  }
}
