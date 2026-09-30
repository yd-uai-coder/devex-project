// 作成：Phase-11-5
// 写経レベル: 定型 ── 既存 uml/page.tsx と同じ Server Component → Client Component の委譲。
import { RequireAuth } from "@/components/auth/RequireAuth";
import { UmlDiagramPageContent } from "@/features/uml/components/UmlDiagramPageContent";

// UML設計図のレビュー・編集画面。uml/page.tsxと同じく、ページは非同期のServer Componentのまま
// paramsを解決し、Tamagui/React Flowを使う実処理はClient Componentへ渡す。
export default async function ProjectUmlDiagramPage({
  params,
}: {
  params: Promise<{ id: string; diagramId: string }>;
}) {
  const { id, diagramId } = await params;
  return (
    <RequireAuth>
      <UmlDiagramPageContent projectId={id} diagramId={diagramId} />
    </RequireAuth>
  );
}
