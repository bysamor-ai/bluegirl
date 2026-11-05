import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveTenant, serverErrorResponse } from "@/lib/tenant/api";
import { MAX_UPLOAD_BYTES, validateUpload } from "@/lib/tenant/upload-validation";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

const FOOD_IMAGES_BUCKET = "food-images";

/** multipart 除咗檔案本身仲有少量 boundary／欄位開銷 */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;

const BAD_REQUEST_MESSAGE = "請求格式不正確";

/** 副檔名一律由（已驗證）MIME 推出，唔信使用者提供嘅檔名 */
function extensionFor(mime: string): string {
  const subtype = mime.split("/")[1]?.toLowerCase() ?? "";
  if (subtype === "jpeg") return "jpg";
  return subtype.replace(/[^a-z0-9]/g, "").slice(0, 10) || "img";
}

// 注意：getSupabaseServerClient 用 service role，繞過 RLS（同 storage policy）。
// 租戶隔離靠路徑前綴 `<tenant.id>/`，前綴只來自 server 解析出嚟嘅 tenant.id。

/** POST /api/t/[token]/upload — 上傳食物相片（FormData 欄位 `file`），回 `{ url }` */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const resolved = await resolveTenant(context.params);
    if ("response" in resolved) return resolved.response;
    const { tenant } = resolved;

    // 未解析 body 先擋明顯超標嘅請求（Content-Length 可偽造，真正上限喺下面按實際檔案大細驗）
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return NextResponse.json({ error: "圖片太大，上限係 10 MB" }, { status: 400 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: BAD_REQUEST_MESSAGE }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: BAD_REQUEST_MESSAGE }, { status: 400 });
    }

    const invalid = validateUpload(file);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    const path = `${tenant.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
    const supabase = getSupabaseServerClient();
    const { error } = await supabase.storage
      .from(FOOD_IMAGES_BUCKET)
      .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (error) throw error;

    const { data } = supabase.storage.from(FOOD_IMAGES_BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    return serverErrorResponse("POST upload", e);
  }
}
