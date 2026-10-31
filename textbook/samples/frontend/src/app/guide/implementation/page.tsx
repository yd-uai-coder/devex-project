// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { ImplementationGuide } from "@/features/guide/pages/ImplementationGuide";

// 使い方ガイド: 実装手順書と実装可能性チェック(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["implementation"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["implementation"].summary,
};

export default function ImplementationGuidePage() {
  return <ImplementationGuide />;
}
