import Link from "next/link";
import { notFound } from "next/navigation";
import MenuPreview from "@/components/MenuPreview";
import PrintButton from "@/components/PrintButton";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RestaurantWithItems } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "餐牌展示 | BLUE GIRL 餐牌生成器" };

/** 最終餐牌展示頁 — 適合餐廳presentation／列印 */
export default async function MenuPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let restaurant: RestaurantWithItems | null = null;
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("restaurants")
      .select("id, name, theme, background, created_at, menu_items(*)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "menu_items", ascending: true })
      .single();
    restaurant = data as RestaurantWithItems | null;
  } catch {
    restaurant = null;
  }

  if (!restaurant) notFound();

  const items = restaurant.menu_items.map((item) => ({
    name: item.name,
    price: Number(item.price),
    imageUrl: item.image_url ?? undefined,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← 返回記錄
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/editor/${restaurant.id}`}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            ✏️ 編輯
          </Link>
          <PrintButton />
        </div>
      </div>

      <MenuPreview
        name={restaurant.name}
        theme={restaurant.theme}
        background={restaurant.background ?? "none"}
        items={items}
      />
    </div>
  );
}
