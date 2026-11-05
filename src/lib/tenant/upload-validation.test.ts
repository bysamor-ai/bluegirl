import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, validateUpload } from "./upload-validation";

describe("validateUpload", () => {
  it("MAX_UPLOAD_BYTES 係 4 MB（Vercel body 上限 4.5MB 之下）", () => {
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
    expect(MAX_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
  it("接受 image/jpeg", () => expect(validateUpload({ type: "image/jpeg", size: 1000 })).toBeNull());
  it("拒絕非圖片", () => expect(validateUpload({ type: "application/pdf", size: 1000 })).toMatch(/圖片/));
  it("拒絕空 type", () => expect(validateUpload({ type: "", size: 1000 })).toMatch(/圖片/));
  it("拒絕只係以 image/ 開頭但冇 subtype", () => expect(validateUpload({ type: "image/", size: 1000 })).toMatch(/圖片/));
  it("拒絕 SVG（可夾帶 script）", () => expect(validateUpload({ type: "image/svg+xml", size: 1000 })).toMatch(/圖片/));
  it("拒絕超過 4MB", () => expect(validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/4 MB/));
  it("啱啱 4MB 可以接受", () => expect(validateUpload({ type: "image/png", size: MAX_UPLOAD_BYTES })).toBeNull());
  it("拒絕 0 byte", () => expect(validateUpload({ type: "image/png", size: 0 })).not.toBeNull());
  it("拒絕負數 / NaN size", () => {
    expect(validateUpload({ type: "image/png", size: -1 })).not.toBeNull();
    expect(validateUpload({ type: "image/png", size: NaN })).not.toBeNull();
  });
});
