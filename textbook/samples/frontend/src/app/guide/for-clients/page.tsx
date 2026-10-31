// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { ForClientsGuide } from "@/features/guide/pages/ForClientsGuide";

// 使い方ガイド: クライアントの方へ(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["for-clients"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["for-clients"].summary,
};

export default function ForClientsGuidePage() {
  return <ForClientsGuide />;
}
