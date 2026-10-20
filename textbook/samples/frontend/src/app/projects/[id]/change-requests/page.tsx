// 作成：Phase-87-2
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChangeRequestsPageContent } from "@/features/change-requests/components/ChangeRequestsPageContent";

// 変更要求(CR)の一覧と作成(SCR-010)。他の動的ページと同じく、params の解決だけを Server Component で
// 行い、Tamagui を使う実体は Client Component に委ねる。
export default async function ChangeRequestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <ChangeRequestsPageContent projectId={id} />
    </RequireAuth>
  );
}
