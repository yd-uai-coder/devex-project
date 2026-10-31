// 作成：Phase-118-4
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { DetailedDesignGuide } from "@/features/guide/pages/DetailedDesignGuide";

// 使い方ガイド: 詳細設計モード(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["detailed-design"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["detailed-design"].summary,
};

export default function DetailedDesignGuidePage() {
  return <DetailedDesignGuide />;
}
