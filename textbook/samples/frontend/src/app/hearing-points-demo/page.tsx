// 作成：Phase-33-3
import { HearingPointsDemoPageContent } from "@/features/hearing-points/demo/HearingPointsDemoPageContent";

// ヒアリングの観点の表・選択肢カード・要件の出どころの見せ方を、仮データで確かめるための開発用デモページ。
// ログイン不要(サーバーと通信しないため)。Tamagui を使う実処理は Client Component に委ねる。
export default function HearingPointsDemoPage() {
  return <HearingPointsDemoPageContent />;
}
