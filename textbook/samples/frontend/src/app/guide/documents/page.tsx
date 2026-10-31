// 作成：Phase-118-4
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { DocumentsGuide } from "@/features/guide/pages/DocumentsGuide";

// 使い方ガイド: 4文書の生成(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["documents"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["documents"].summary,
};

export default function DocumentsGuidePage() {
  return <DocumentsGuide />;
}
