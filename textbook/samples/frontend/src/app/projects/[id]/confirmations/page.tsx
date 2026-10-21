// 作成：Phase-98-1
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ConfirmationsPageContent } from "@/features/confirmations/components/ConfirmationsPageContent";

// 確認事項の一覧(SCR-011)。他の動的ページと同じく、params の解決だけを Server Component で行い、
// Tamagui を使う実体は Client Component に委ねる。
export default async function ConfirmationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <ConfirmationsPageContent projectId={id} />
    </RequireAuth>
  );
}
