// 作成：Phase-51-3
import { DesignReviewDemoPageContent } from "@/features/design-review/demo/DesignReviewDemoPageContent";

// AI 設計レビューの見せ方を、仮データで確かめるための開発用デモページ。
// ログイン不要(サーバーと通信しないため)。Tamagui を使う実処理は Client Component に委ねる。
export default function DesignReviewDemoPage() {
  return <DesignReviewDemoPageContent />;
}
