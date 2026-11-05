import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const uploads: { bucket: string; path: string; size: number; opts: unknown }[] = [];
let uploadError: { message: string } | null = null;

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: ArrayBuffer | Uint8Array, opts: unknown) => {
          if (uploadError) return { data: null, error: uploadError };
          uploads.push({ bucket, path, size: body.byteLength, opts });
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://storage.example/${bucket}/${path}` },
        }),
      }),
    },
  }),
}));

const getTenantByToken = vi.fn();
vi.mock("@/lib/tenant/resolve", () => ({
  getTenantByToken: (t: string) => getTenantByToken(t),
}));

import { POST } from "./route";
import { MAX_UPLOAD_BYTES } from "@/lib/tenant/upload-validation";

const A = { id: "tenant-a", token: "aaaaaaaaaaaa" };
const ctx = (params: unknown) => ({ params: Promise.resolve(params) }) as never;
const reqWith = (form: FormData | Error, headers: Record<string, string> = {}) =>
  ({
    headers: new Headers(headers),
    formData: async () => {
      if (form instanceof Error) throw form;
      return form;
    },
  }) as unknown as NextRequest;
const formOf = (file: unknown) => {
  const f = new FormData();
  if (file !== undefined) f.append("file", file as Blob | string);
  return f;
};
const png = (size = 100, name = "x.png", type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  uploads.length = 0;
  uploadError = null;
  getTenantByToken.mockImplementation(async (t: string) => (t === A.token ? A : null));
});

describe("POST /api/t/[token]/upload", () => {
  it("成功：路徑帶租戶 id 前綴，回公開 URL", async () => {
    const res = await POST(reqWith(formOf(png())), ctx({ token: A.token }));
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(uploads).toHaveLength(1);
    expect(uploads[0].bucket).toBe("food-images");
    expect(uploads[0].path).toMatch(/^tenant-a\/[0-9a-f-]{36}\.png$/);
    expect(uploads[0].size).toBe(100);
    expect(uploads[0].opts).toMatchObject({ contentType: "image/png", upsert: false });
    expect(url).toBe(`https://storage.example/food-images/${uploads[0].path}`);
  });

  it("副檔名由 MIME 決定，唔信檔名（../、script）", async () => {
    await POST(
      reqWith(formOf(png(10, "../../evil.php", "image/jpeg"))),
      ctx({ token: A.token })
    );
    expect(uploads[0].path).toMatch(/^tenant-a\/[0-9a-f-]{36}\.jpg$/);
  });

  it("token 查唔到 → 404，唔上傳", async () => {
    const res = await POST(reqWith(formOf(png())), ctx({ token: "zzzzzzzzzzzz" }));
    expect(res.status).toBe(404);
    expect(uploads).toHaveLength(0);
  });

  it("token 非 string → 404", async () => {
    const res = await POST(reqWith(formOf(png())), ctx({ token: ["a"] }));
    expect(res.status).toBe(404);
  });

  it("租戶查詢 DB 故障 → 500 通用訊息，唔洩露", async () => {
    getTenantByToken.mockRejectedValue(new Error("SECRET_DB_DETAIL"));
    const res = await POST(reqWith(formOf(png())), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(uploads).toHaveLength(0);
  });

  it("body 唔係 multipart → 400", async () => {
    const res = await POST(reqWith(new TypeError("bad body")), ctx({ token: A.token }));
    expect(res.status).toBe(400);
  });

  it.each([[undefined], ["just text"]])("冇 file 欄位或唔係檔案（%j）→ 400", async (v) => {
    const res = await POST(reqWith(formOf(v)), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it("非圖片 → 400", async () => {
    const res = await POST(
      reqWith(formOf(png(10, "a.pdf", "application/pdf"))),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/圖片/);
    expect(uploads).toHaveLength(0);
  });

  it("0 byte → 400", async () => {
    const res = await POST(reqWith(formOf(png(0))), ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect(uploads).toHaveLength(0);
  });

  it("超過 4MB → 400", async () => {
    const res = await POST(
      reqWith(formOf(png(MAX_UPLOAD_BYTES + 1))),
      ctx({ token: A.token })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/4 MB/);
    expect(uploads).toHaveLength(0);
  });

  it("Content-Length 明顯超標 → 400，唔解析 body", async () => {
    const formData = vi.fn();
    const r = {
      headers: new Headers({ "content-length": String(MAX_UPLOAD_BYTES * 3) }),
      formData,
    } as unknown as NextRequest;
    const res = await POST(r, ctx({ token: A.token }));
    expect(res.status).toBe(400);
    expect(formData).not.toHaveBeenCalled();
  });

  it("Storage 故障 → 500 通用訊息，唔洩露", async () => {
    uploadError = { message: "SECRET_BUCKET_DETAIL" };
    const res = await POST(reqWith(formOf(png())), ctx({ token: A.token }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("SECRET");
    expect(console.error).toHaveBeenCalled();
  });
});
