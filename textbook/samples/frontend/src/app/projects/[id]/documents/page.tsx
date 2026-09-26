// 作成：Phase-3-6
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DocumentsPageContent } from "@/features/documents/components/DocumentsPageContent";

// Phase-3-5のチャットページと同じ理由(Next.js 16でparamsがPromiseになる)で、
// このページ自体は非同期のServer Componentのままにし、フックを使う実処理は
// Client Component(DocumentsPageContent)に切り出して解決済みのidだけを渡す。
export default async function ProjectDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <DocumentsPageContent projectId={id} />
    </RequireAuth>
  );
}
