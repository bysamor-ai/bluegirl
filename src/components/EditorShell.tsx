"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { restaurantFormSchema, type RestaurantFormValues } from "@/lib/schemas";
import MenuForm from "./MenuForm";
import MenuPreview from "./MenuPreview";

const EMPTY_FORM: RestaurantFormValues = {
  name: "",
  theme: "classic",
  background: "none",
  items: [{ name: "", price: 0, imageUrl: "" }],
};

/** 表單值變動時即時更新嘅預覽（訂閱整個表單） */
function LivePreview() {
  const values = useWatch<RestaurantFormValues>();
  const items = (values.items ?? []).map((item) => ({
    name: item?.name ?? "",
    price: Number.isFinite(item?.price) ? Number(item?.price) : 0,
    imageUrl: item?.imageUrl || undefined,
  }));

  return (
    <MenuPreview
      name={values.name ?? ""}
      theme={values.theme ?? "classic"}
      background={values.background ?? "none"}
      items={items}
    />
  );
}

/** 編輯器版面：左邊表單、右邊即時預覽（手機上下排列） */
export default function EditorShell({
  initial,
}: {
  initial?: RestaurantFormValues;
}) {
  const methods = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: initial ?? EMPTY_FORM,
    mode: "onBlur",
  });

  return (
    <FormProvider {...methods}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h1 className="mb-4 text-xl font-bold">
            {initial?.id ? "編輯餐牌" : "建立新餐牌"}
          </h1>
          <MenuForm />
        </div>
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
            即時預覽
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              即時更新
            </span>
          </h2>
          <div className="lg:sticky lg:top-6">
            <LivePreview />
          </div>
        </div>
      </div>
    </FormProvider>
  );
}
