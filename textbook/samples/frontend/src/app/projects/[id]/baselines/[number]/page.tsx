// 作成：Phase-88-3
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BaselineDetailContent } from "@/features/baselines/components/BaselineDetailContent";

// 合意済みの版(束)の中身(SCR-010)。params の解決だけを Server Component で行い、番号を数にして渡す。
export default async function BaselineDetailPage({
  params,
}: {
  params: Promise<{ id: string; number: string }>;
}) {
  const { id, number } = await params;
  return (
    <RequireAuth>
      <BaselineDetailContent projectId={id} number={Number(number)} />
    </RequireAuth>
  );
}
