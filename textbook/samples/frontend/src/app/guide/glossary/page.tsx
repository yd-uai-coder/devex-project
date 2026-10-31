// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { GlossaryGuide } from "@/features/guide/pages/GlossaryGuide";

// 使い方ガイド: 用語集とよくある質問(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["glossary"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["glossary"].summary,
};

export default function GlossaryGuidePage() {
  return <GlossaryGuide />;
}
