// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { ReviewGuide } from "@/features/guide/pages/ReviewGuide";

// 使い方ガイド: 設計レビュー・テスト設計・変更の影響(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["review"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["review"].summary,
};

export default function ReviewGuidePage() {
  return <ReviewGuide />;
}
