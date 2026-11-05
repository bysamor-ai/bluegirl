import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { z } from "zod";
import { resolveTenant, serverErrorResponse } from "@/lib/tenant/api";
import { safeBrandColor } from "@/lib/tenant/brand";
import {
  buildStickerPrompt,
  getStickerStyle,
  pickImageSize,
} from "@/lib/wall-sticker/stickerStyles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_MODEL = "openai/gpt-image-2";

const bodySchema = z.object({
  merchantName: z
    .string()
    .max(60, { message: "商戶名稱最多 60 個字" })
    .optional()
    .default(""),
  highlight: z
    .string()
    .max(120, { message: "主打內容最多 120 個字" })
    .optional()
    .default(""),
  style: z.string().optional().default("classic"),
  aspectRatio: z
    .number({ invalid_type_error: "長寬比要係數字" })
    .positive({ message: "長寬比要大過 0" })
    .finite({ message: "長寬比數值無效" })
    .optional()
    .default(1.2),
});

type RouteContext = { params: Promise<{ token: string }> };

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

/**
 * POST /api/t/[token]/generate-sticker-design
 * 生成一張牆貼設計稿（顏色跟租戶主色，冇品牌素材嘅租戶唔會出 logo／樽）。
 * 呢條 route 唔掂資料庫，只需要確認 token 有效（唔可以俾人用亂 token 白嘥 fal 額度）。
 * FAL_KEY 只存在於伺服器環境變數，唔會出現喺客戶端 bundle。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "提交嘅資料格式不正確" }, { status: 400 });
    }

    const falKey = process.env.FAL_KEY;
    if (!falKey) throw new Error("未設定 FAL_KEY 環境變數");

    const { merchantName, highlight, style, aspectRatio } = parsed.data;
    const styleConfig = getStickerStyle(style);

    // 英文 prompt 出圖較穩定；中文字交由前端疊字，所以明確叫佢唔好出文字。
    const prompt = buildStickerPrompt({
      style: styleConfig,
      tenantName: tenant.name,
      primaryColor: safeBrandColor(tenant.primaryColor),
      hasBrandAssets: tenant.backgrounds.length > 0,
      merchantName,
      highlight,
    });

    let imageUrl: string | undefined;
    try {
      fal.config({ credentials: falKey });
      const result = await fal.subscribe(
        process.env.FAL_STICKER_MODEL || DEFAULT_MODEL,
        {
          input: {
            prompt,
            image_size: pickImageSize(aspectRatio),
            num_images: 1,
          },
        }
      );
      imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    } catch (e) {
      console.error("[api] 牆貼設計稿生成失敗", e);
      return NextResponse.json({ error: "生成失敗，請稍後再試" }, { status: 502 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "冇生成到圖片，請再試一次" }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (e) {
    return serverErrorResponse("POST generate-sticker-design", e);
  }
}
