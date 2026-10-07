// 作成：Phase-25-2
import { ImplementationProcedureDemoPageContent } from "@/features/implementation-procedure/demo/ImplementationProcedureDemoPageContent";

// 実装手順書(段階8)の見せ方を、仮データで確かめるための開発用デモページ。
// ログイン不要(サーバーと通信しないため)。Tamagui を使う実処理は Client Component に委ねる。
export default function ImplementationProcedureDemoPage() {
  return <ImplementationProcedureDemoPageContent />;
}
