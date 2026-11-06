/* eslint-disable @next/next/no-img-element */
import Image, { type ImageProps } from "next/image";
import { canOptimizeImage } from "@/lib/image-host";

type Props = Omit<ImageProps, "src" | "alt"> & { src: string; alt: string };

/**
 * 白名單內嘅圖（Supabase 公開 storage、fal.media、本地 public/）用 next/image，
 * 令 Supabase 只送一次畀 Vercel，之後由 Vercel CDN 食；
 * 其他（data:、blob:、任意外部 host）退回原生 <img>，外觀一致。
 */
export default function SmartImage({ src, ...rest }: Props) {
  if (canOptimizeImage(src)) return <Image src={src} {...rest} />;
  const { fill, width, height, style, alt, className, priority, quality, sizes, placeholder, blurDataURL, loader, unoptimized, overrideSrc, onLoadingComplete, ...img } = rest;
  void [priority, quality, sizes, placeholder, blurDataURL, loader, unoptimized, overrideSrc, onLoadingComplete];
  return (
    <img
      {...img}
      src={src}
      alt={alt}
      className={className}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
    />
  );
}
