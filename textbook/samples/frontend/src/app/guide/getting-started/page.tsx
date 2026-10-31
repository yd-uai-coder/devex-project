// 作成：Phase-118-4
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { GettingStartedGuide } from "@/features/guide/pages/GettingStartedGuide";

// 使い方ガイド: はじめに(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["getting-started"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["getting-started"].summary,
};

export default function GettingStartedGuidePage() {
  return <GettingStartedGuide />;
}
