// 作成：Phase-88-3
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BaselinesPageContent } from "@/features/baselines/components/BaselinesPageContent";

// 合意済みの版(束)の一覧と作成(SCR-010)。他の動的ページと同じく、params の解決だけを Server Component で
// 行い、Tamagui を使う実体は Client Component に委ねる。
export default async function BaselinesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireAuth>
      <BaselinesPageContent projectId={id} />
    </RequireAuth>
  );
}
