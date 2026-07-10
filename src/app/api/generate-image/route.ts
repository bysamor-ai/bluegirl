import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { generateImageSchema } from "@/lib/schemas";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 圖片生成需時，放寬 Vercel function 時限

const DEFAULT_MODEL = "fal-ai/gpt-image-1/text-to-image";

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

  const { foodName, restaurantName, restaurantId, menuItemId } = parsed.data;
  const model = process.env.FAL_IMAGE_MODEL || DEFAULT_MODEL;

  // 用英文 prompt 生成質素較穩定，菜式名稱保留原文
  const prompt =
    `Professional food photography of "${foodName}", a dish served at a Hong Kong restaurant` +
    (restaurantName ? ` called "${restaurantName}"` : "") +
    `. Appetizing close-up on a clean plate, soft natural lighting, ` +
    `shallow depth of field, restaurant menu style photo, no text or watermark.`;

  try {
    fal.config({ credentials: falKey });

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        image_size: "1024x1024",
        quality: "medium",
        num_images: 1,
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
