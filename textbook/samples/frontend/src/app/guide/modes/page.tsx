// 作成：Phase-118(完了後の調整2)
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { ModesGuide } from "@/features/guide/pages/ModesGuide";

// 使い方ガイド: 2つのモードと作る文書(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["modes"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["modes"].summary,
};

export default function ModesGuidePage() {
  return <ModesGuide />;
}
