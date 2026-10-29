// 作成：Phase-116-2
import { RequireAuth } from "@/components/auth/RequireAuth";
import { MaterialDetailContent } from "@/features/materials/components/MaterialDetailContent";

// 資料1件(SCR-013。本文と違いの一覧)。params の解決だけを Server Component で行う。
export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  return (
    <RequireAuth>
      <MaterialDetailContent projectId={id} materialId={mid} />
    </RequireAuth>
  );
}
