// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { MaterialsGuide } from "@/features/guide/pages/MaterialsGuide";

// 使い方ガイド: 資料の取り込み(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["materials"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["materials"].summary,
};

export default function MaterialsGuidePage() {
  return <MaterialsGuide />;
}
