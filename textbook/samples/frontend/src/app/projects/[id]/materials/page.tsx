// 作成：Phase-116-2
import { RequireAuth } from "@/components/auth/RequireAuth";
import { MaterialsPageContent } from "@/features/materials/components/MaterialsPageContent";

// 資料の一覧と追加(SCR-013)。他の動的ページと同じく、params の解決だけを Server Component で
// 行い、Tamagui を使う実体は Client Component に委ねる。
export default async function MaterialsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <MaterialsPageContent projectId={id} />
    </RequireAuth>
  );
}
