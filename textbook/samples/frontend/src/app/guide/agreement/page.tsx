// 作成：Phase-118-5
import type { Metadata } from "next";
import { GUIDE_PAGES } from "@/features/guide/guide-flow";
import { AgreementGuide } from "@/features/guide/pages/AgreementGuide";

// 使い方ガイド: 合意と変更管理(ログインは要らない)
export const metadata: Metadata = {
  title: `${GUIDE_PAGES["agreement"].title} | 使い方ガイド | Devex`,
  description: GUIDE_PAGES["agreement"].summary,
};

export default function AgreementGuidePage() {
  return <AgreementGuide />;
}
