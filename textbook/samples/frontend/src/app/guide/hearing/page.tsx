// 作成：Phase-118-4
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { HearingGuide } from "@/features/guide/pages/HearingGuide";

// 使い方ガイド: ヒアリング(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["hearing"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["hearing"].summary,
};

export default function HearingGuidePage() {
  return <HearingGuide />;
}
