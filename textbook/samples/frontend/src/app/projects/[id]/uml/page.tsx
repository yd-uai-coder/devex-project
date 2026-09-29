// 作成：Phase-7-3
import { RequireAuth } from "@/components/auth/RequireAuth";
import { UmlPageContent } from "@/features/uml/components/UmlPageContent";

// Phase 7の技術検証スパイク(使い捨て): documents/page.tsxと同じ理由(Next.js 16でparamsが
// Promiseになる)で、ページ自体は非同期のServer Componentのままにし、Tamagui/React Flowを
// 使う実処理はClient Component(UmlPageContent)に切り出して解決済みのidだけを渡す。
export default async function ProjectUmlPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <UmlPageContent projectId={id} />
    </RequireAuth>
  );
}
