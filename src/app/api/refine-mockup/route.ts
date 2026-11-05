import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_EDIT_MODEL = "openai/gpt-image-2/edit";

/** 前端合成好嘅 mockup 大約 200–600 KB；留 8 MB 上限做保險 */
const MAX_DATA_URL_BYTES = 8 * 1024 * 1024;

const bodySchema = z.object({
  mockupDataUrl: z
    .string({ required_error: "缺少效果圖資料" })
    .startsWith("data:image/", { message: "只接受圖片 data URL" })
    .max(MAX_DATA_URL_BYTES, { message: "圖片太大，請用細一啲嘅相片" }),
});

interface FalImageOutput {
  images?: Array<{ url?: string }>;
}

/** 將 data URL 轉做 File，方便上傳去 fal storage。 */
function dataUrlToFile(dataUrl: string, name: string): File {
  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("圖片格式不正確");
  const [, mime, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new File([bytes], name, { type: mime });
}

/**
 * POST /api/refine-mockup
 * 將前端合成嘅實景效果圖交俾 fal.ai，執靚牆身光影、反光同邊緣，
 * 令貼圖睇落真係印咗喺牆上面。設計稿內容本身要求保持不變。
 */
export async function POST(request: NextRequest) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    return NextResponse.json(
      { error: "未設定 FAL_KEY 環境變數，無法做 AI 精修" },
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

  try {
    fal.config({ credentials: falKey });

    const file = dataUrlToFile(parsed.data.mockupDataUrl, "mockup.jpg");
    const mockupUrl = await fal.storage.upload(file);

    const prompt =
      `This photo already has a wall sticker composited onto the wall. ` +
      `Make it look like the sticker was really printed and applied there: ` +
      `match the wall's lighting, shadows and colour temperature, add a subtle ` +
      `contact shadow along its edges, follow the wall's texture and any curvature, ` +
      `and add realistic sheen where light falls on it. ` +
      `CRITICAL: keep the sticker's artwork, layout, colours, proportions and position ` +
      `exactly as they are — do not redesign it, do not move or resize it, ` +
      `do not add or change any text. ` +
      `Keep the rest of the photo — the shopfront, people, street and objects in front ` +
      `of the wall — completely unchanged. Photorealistic result.`;

    const result = await fal.subscribe(
      process.env.FAL_REFINE_MODEL || DEFAULT_EDIT_MODEL,
      {
        input: {
          prompt,
          image_urls: [mockupUrl],
          quality: "medium",
          num_images: 1,
        },
      }
    );

    const imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: "fal.ai 冇回傳圖片，請稍後再試" },
        { status: 502 }
      );
    }

    return NextResponse.json({ imageUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "精修失敗";
    return NextResponse.json({ error: `精修失敗：${message}` }, { status: 502 });
  }
}
