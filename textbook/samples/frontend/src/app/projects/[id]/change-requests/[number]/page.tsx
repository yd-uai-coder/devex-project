// 作成：Phase-87-3
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChangeRequestDetailContent } from "@/features/change-requests/components/ChangeRequestDetailContent";

// 変更要求(CR)の詳細(SCR-010)。params の解決だけを Server Component で行い、番号を数にして渡す。
export default async function ChangeRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const { id, number } = await params;
  return (
    <RequireAuth>
      <ChangeRequestDetailContent projectId={id} number={Number(number)} />
    </RequireAuth>
  );
}
