// 作成：Phase-7-3｜更新：Phase-11-4
import { RequireAuth } from "@/components/auth/RequireAuth";
import { UmlPageContent } from "@/features/uml/components/UmlPageContent";

// Phase-11-4：更新(スパイクの注記を本実装の説明に差し替え。コードは変更なし)
// // Phase 7の技術検証スパイク(使い捨て): documents/page.tsxと同じ理由(Next.js 16でparamsが
// // Promiseになる)で、ページ自体は非同期のServer Componentのままにし、Tamagui/React Flowを
// // 使う実処理はClient Component(UmlPageContent)に切り出して解決済みのidだけを渡す。
// ↓↓
// UML設計図の生成・一覧画面。documents/page.tsxと同じ理由(Next.js 16でparamsが
// Promiseになる)で、ページ自体は非同期のServer Componentのままにし、Tamaguiを
// 使う実処理はClient Component(UmlPageContent)に切り出して解決済みのidだけを渡す。
export default async function ProjectUmlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <UmlPageContent projectId={id} />
    </RequireAuth>
  );
}
