// 作成：Phase-41-3
import { ChangeImpactDemoPageContent } from "@/features/change-impact/demo/ChangeImpactDemoPageContent";

// 変更の影響範囲の見せ方を、仮データで確かめるための開発用デモページ。
// ログイン不要(サーバーと通信しないため)。Tamagui を使う実処理は Client Component に委ねる。
export default function ChangeImpactDemoPage() {
  return <ChangeImpactDemoPageContent />;
}
