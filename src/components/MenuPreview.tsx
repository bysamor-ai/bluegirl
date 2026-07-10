import { getTheme, type ThemeId } from "@/lib/themes";
import { formatHKD } from "@/lib/format";

/**
 * 餐牌預覽 — 純展示元件（無 hooks），
 * 編輯器即時預覽同 /menu/[id] 展示頁共用。
 */

export interface PreviewItem {
  name: string;
  price: number;
  imageUrl?: string;
}

interface MenuPreviewProps {
  name: string;
  theme: ThemeId;
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

export default function MenuPreview({ name, theme, items }: MenuPreviewProps) {
  const t = getTheme(theme);
  const validItems = items.filter((item) => item.name.trim() !== "");

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
