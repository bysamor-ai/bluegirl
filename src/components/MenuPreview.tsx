import { getTheme, type ThemeId } from "@/lib/themes";
import { getBackground, type BackgroundId } from "@/lib/backgrounds";
import { formatHKD } from "@/lib/format";

/**
 * 餐牌預覽 — 純展示元件（無 hooks），
 * 編輯器即時預覽同 /menu/[id] 展示頁共用。
 * 揀咗 BLUE GIRL 品牌背景時會用品牌版面；否則用主題色版面。
 */

export interface PreviewItem {
  name: string;
  price: number;
  imageUrl?: string;
}

interface MenuPreviewProps {
  name: string;
  theme: ThemeId;
  background?: BackgroundId;
  items: PreviewItem[];
}

function ItemImage({
  item,
  frameClass,
  placeholderClass,
}: {
  item: PreviewItem;
  frameClass: string;
  placeholderClass: string;
}) {
  return (
    <div className={frameClass}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt={item.name || "菜式相片"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-2xl ${placeholderClass}`}
          aria-label="未有相片"
        >
          🍽️
        </div>
      )}
    </div>
  );
}

/** BLUE GIRL 品牌背景版面：深藍字 + 半透明白底行，避開品牌 footer 安全區 */
function BrandedMenu({
  name,
  backgroundId,
  items,
}: {
  name: string;
  backgroundId: BackgroundId;
  items: PreviewItem[];
}) {
  const bg = getBackground(backgroundId);
  const navy = "text-[#1e2a63]";
  // 項目多過 5 個自動轉兩欄，容納 6–9+ 項
  const useGrid = items.length > 5;

  return (
    // grid 疊層：spacer 以 aspect-ratio 做「最小高度」，內容多過位時容器向下伸展；
    // 背景圖 absolute + object-bottom，品牌 footer 永遠貼住底部
    <div className="relative grid overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {bg.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg.src}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-bottom"
        />
      )}
      <div style={{ aspectRatio: bg.aspect }} className="[grid-area:1/1]" />
      <div
        className={`relative flex flex-col [grid-area:1/1] ${bg.contentClass}`}
      >
        <header className="pb-3 text-center">
          <h2
            className={`font-serif text-2xl font-bold tracking-widest sm:text-3xl ${navy}`}
          >
            {name.trim() || "餐廳名稱"}
          </h2>
          <div className="mx-auto mt-2 h-px w-24 bg-[#1e2a63]/50" />
        </header>

        {items.length === 0 ? (
          <p className={`py-8 text-center text-sm opacity-70 ${navy}`}>
            未有菜式 — 請喺表單加入菜式名稱
          </p>
        ) : (
          <ul
            className={
              useGrid
                ? "grid content-start gap-x-4 gap-y-2"
                : "flex flex-col gap-2"
            }
            style={
              useGrid
                ? {
                    // 按容器實際闊度自動決定欄數（唔跟 viewport）
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                  }
                : undefined
            }
          >
            {items.map((item, index) => (
              <li
                key={index}
                className="flex items-center gap-3 rounded-lg bg-white/60 px-3 py-2"
              >
                <ItemImage
                  item={item}
                  frameClass="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#1e2a63]/30"
                  placeholderClass="bg-[#1e2a63]/10 text-base"
                />
                <span className={`min-w-0 flex-1 truncate text-sm font-semibold sm:text-base ${navy}`}>
                  {item.name}
                </span>
                <span className={`shrink-0 text-sm font-bold sm:text-base ${navy}`}>
                  {formatHKD(item.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MenuPreview({
  name,
  theme,
  background = "none",
  items,
}: MenuPreviewProps) {
  const validItems = items.filter((item) => item.name.trim() !== "");

  // 揀咗品牌背景 → 品牌版面優先
  if (background !== "none") {
    return (
      <BrandedMenu name={name} backgroundId={background} items={validItems} />
    );
  }

  const t = getTheme(theme);

  return (
    <div className={t.card}>
      <header className={t.header}>
        {t.badgeText && <div className={t.badgeClass}>{t.badgeText}</div>}
        <h2 className={t.headerText}>{name.trim() || "餐廳名稱"}</h2>
        <div className={t.divider} />
      </header>

      {validItems.length === 0 ? (
        <p className="py-10 text-center text-sm opacity-60">
          未有菜式 — 請喺表單加入菜式名稱
        </p>
      ) : t.itemLayout === "list" ? (
        <ul>
          {validItems.map((item, index) => (
            <li key={index} className={t.itemCard}>
              <ItemImage
                item={item}
                frameClass={t.imageFrame}
                placeholderClass={t.imagePlaceholder}
              />
              <span className={t.itemName}>{item.name}</span>
              <span className={t.itemPrice}>{formatHKD(item.price)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {validItems.map((item, index) => (
            <li key={index} className={t.itemCard}>
              <ItemImage
                item={item}
                frameClass={t.imageFrame}
                placeholderClass={t.imagePlaceholder}
              />
              <span className={t.itemName}>{item.name}</span>
              <span className={t.itemPrice}>{formatHKD(item.price)}</span>
            </li>
          ))}
        </ul>
      )}

      <footer className={t.footerClass}>{t.footerText}</footer>
    </div>
  );
}
