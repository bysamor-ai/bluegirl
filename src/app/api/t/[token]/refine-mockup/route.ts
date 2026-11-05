import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { z } from "zod";
import { resolveTenant, serverErrorResponse } from "@/lib/tenant/api";

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

type RouteContext = { params: Promise<{ token: string }> };

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
 * POST /api/t/[token]/refine-mockup
 * 將前端合成嘅實景效果圖交俾 fal.ai，執靚牆身光影、反光同邊緣，
 * 令貼圖睇落真係印咗喺牆上面。設計稿內容本身要求保持不變。
 * 呢條 route 唔掂資料庫，只需要確認 token 有效。
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;

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

    let imageUrl: string | undefined;
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
      imageUrl = (result.data as FalImageOutput)?.images?.[0]?.url;
    } catch (e) {
      console.error("[api] 效果圖精修失敗", e);
      return NextResponse.json({ error: "精修失敗，請稍後再試" }, { status: 502 });
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "冇生成到圖片，請稍後再試" }, { status: 502 });
    }

    return NextResponse.json({ imageUrl });
  } catch (e) {
    return serverErrorResponse("POST refine-mockup", e);
  }
}
