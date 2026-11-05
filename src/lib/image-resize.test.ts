import { describe, expect, it } from "vitest";
import {
  MAX_LONG_EDGE,
  computeTargetSize,
  resizedFileName,
  shouldResize,
} from "./image-resize";
import { MAX_UPLOAD_BYTES } from "./tenant/upload-validation";

describe("shouldResize", () => {
  it("細過上限嘅 JPEG 唔重新編碼", () => {
    expect(shouldResize({ type: "image/jpeg", size: MAX_UPLOAD_BYTES - 1 })).toBe(false);
  });
  it("啱啱等於上限都唔縮", () => {
    expect(shouldResize({ type: "image/jpeg", size: MAX_UPLOAD_BYTES })).toBe(false);
  });
  it("細過上限嘅 PNG 唔轉 JPEG（保留透明度）", () => {
    expect(shouldResize({ type: "image/png", size: 1000 })).toBe(false);
  });
  it("超過上限嘅 JPEG／PNG／WebP／HEIC 要縮", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(shouldResize({ type, size: MAX_UPLOAD_BYTES + 1 })).toBe(true);
    }
  });
  it("GIF 唔縮（canvas 會令動畫變靜止）", () => {
    expect(shouldResize({ type: "image/gif", size: MAX_UPLOAD_BYTES + 1 })).toBe(false);
  });
  it("非圖片唔縮（交畀驗證擋）", () => {
    expect(shouldResize({ type: "application/pdf", size: MAX_UPLOAD_BYTES + 1 })).toBe(false);
  });
  it("0 byte 唔縮", () => {
    expect(shouldResize({ type: "image/jpeg", size: 0 })).toBe(false);
  });
});

describe("computeTargetSize", () => {
  it("MAX_LONG_EDGE 係 2000", () => expect(MAX_LONG_EDGE).toBe(2000));
  it("橫圖：長邊縮到上限，保持比例", () => {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });
  it("直圖：長邊係高", () => {
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1500, height: 2000 });
  });
  it("細過上限唔放大", () => {
    expect(computeTargetSize(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
  it("剛好等於上限", () => {
    expect(computeTargetSize(2000, 1000)).toEqual({ width: 2000, height: 1000 });
  });
  it("極端長寬比最短邊最少 1px", () => {
    expect(computeTargetSize(20000, 3)).toEqual({ width: 2000, height: 1 });
  });
  it("可自訂上限", () => {
    expect(computeTargetSize(1000, 500, 500)).toEqual({ width: 500, height: 250 });
  });
  it.each([[0, 100], [100, 0], [-1, 5], [NaN, 5], [Infinity, 5]])("無效尺寸（%s×%s）回 null", (w, h) => {
    expect(computeTargetSize(w, h)).toBeNull();
  });
});

describe("resizedFileName", () => {
  it("副檔名換成 .jpg", () => expect(resizedFileName("IMG_001.HEIC")).toBe("IMG_001.jpg"));
  it("冇副檔名", () => expect(resizedFileName("photo")).toBe("photo.jpg"));
  it("多個點只換最後一個", () => expect(resizedFileName("a.b.png")).toBe("a.b.jpg"));
  it("空檔名", () => expect(resizedFileName("")).toBe("photo.jpg"));
});
