import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { z } from "zod";
import {
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

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

/**
 * POST /api/generate-sticker-design
 * 生成一張 BLUE GIRL 品牌風格嘅牆貼設計稿。
 * FAL_KEY 只存在於伺服器環境變數，唔會出現喺客戶端 bundle。
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "未設定 FAL_KEY 環境變數，無法生成設計稿" },
      { status: 500 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式不正確" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "資料驗證失敗" },
      { status: 400 }
    );
  }

  const { merchantName, highlight, style, aspectRatio } = parsed.data;
  const styleConfig = getStickerStyle(style);

  // 英文 prompt 出圖較穩定；中文字交由前端疊字，所以明確叫佢唔好出文字。
  const prompt =
    `Wall decal artwork for BLUE GIRL imported premium beer, to be printed and ` +
    `applied on a restaurant wall. ${styleConfig.prompt}. ` +
    `Brand palette: deep navy blue (#12204a), metallic gold (#c9a24b), clean white. ` +
    (merchantName
      ? `Designed for a Hong Kong restaurant called "${merchantName}". `
      : "") +
    (highlight ? `Theme of the promotion: ${highlight}. ` : "") +
    `Include the BLUE GIRL beer bottle and brand mark as a graphic element. ` +
    `IMPORTANT: no readable text, no lettering, no words, no captions anywhere in the image — ` +
    `leave clear empty areas where text will be added later. ` +
    `Flat front-facing artwork, edge to edge composition, no mockup, no wall, no room, ` +
    `no perspective, no drop shadow, no frame, no border.`;

  fal.config({ credentials: falKey });

  try {
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

    const data = result.data as FalImageOutput;
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "AI 冇回傳圖片，請再試一次" },
        { status: 502 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失敗";
    return NextResponse.json({ error: `生成失敗：${message}` }, { status: 502 });
  }
}
