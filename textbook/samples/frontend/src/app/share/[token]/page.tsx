// 作成：Phase-108-1
import type { Metadata } from "next";
import { SharedChangeRequestPageContent } from "@/features/share/components/SharedChangeRequestPageContent";

// 共有リンクの画面(SCR-012)。ログインは要らない(RequireAuth で包まない)。URL のトークンを外へ
// 漏らさないよう、検索に載せず、外へのリンクで参照元を送らない
export const metadata: Metadata = {
  title: "変更のご相談 | Devex",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedChangeRequestPageContent token={token} />;
}
