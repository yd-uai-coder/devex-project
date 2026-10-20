// 作成：Phase-88(完了後の調整)
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChangeRequestCreateContent } from "@/features/change-requests/components/ChangeRequestCreateContent";

// 合意済みの版を基準に変更要求を作るページ(SCR-010)。params の解決だけを Server Component で行い、
// 版の番号を数にして渡す(基準の版はこの番号に固定する)。
export default async function NewChangeRequestPage({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const { id, number } = await params;
  return (
    <RequireAuth>
      <ChangeRequestCreateContent projectId={id} baselineNumber={Number(number)} />
    </RequireAuth>
  );
}
