"use client";

import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { restaurantFormSchema, type RestaurantFormValues } from "@/lib/schemas";
import type { BackgroundId } from "@/lib/backgrounds";
import MenuForm from "./MenuForm";

const EMPTY_FORM: RestaurantFormValues = {
  name: "",
  theme: "classic",
  background: "none",
  posterUrl: "",
  items: [{ name: "", price: 0, imageUrl: "" }],
};

/** 編輯器：單欄表單（海報生成結果直接顯示喺表單內） */
export default function EditorShell({
  initial,
  token,
  allowedBackgrounds,
}: {
  initial?: RestaurantFormValues;
  /** 租戶 token：用嚟砌租戶內嘅導航路徑，並穿線落 MenuForm */
  token: string;
  /** 呢個租戶可用嘅背景（唔含 none）。只傳欄位，唔好傳成個 tenant。 */
  allowedBackgrounds: BackgroundId[];
}) {
  const methods = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: initial ?? EMPTY_FORM,
    mode: "onBlur",
  });

  return (
    <FormProvider {...methods}>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-xl font-bold">
          {initial?.id ? "編輯餐牌" : "建立新餐牌"}
        </h1>
        <MenuForm token={token} allowedBackgrounds={allowedBackgrounds} />
      </div>
    </FormProvider>
  );
}
