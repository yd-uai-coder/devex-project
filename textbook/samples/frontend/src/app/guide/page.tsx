// 作成：Phase-118-1
import type { Metadata } from "next";
import { GuideIndexContent } from "@/features/guide/components/GuideIndexContent";

// 使い方ガイドの目次。ログインは要らない(RequireAuth で包まない)
export const metadata: Metadata = {
  title: "使い方ガイド | Devex",
  description: "Devex の使い方を、ヒアリングから合意と変更管理まで、利用の流れの順に機能ごとのページで説明します。",
};

export default function GuidePage() {
  return <GuideIndexContent />;
}
