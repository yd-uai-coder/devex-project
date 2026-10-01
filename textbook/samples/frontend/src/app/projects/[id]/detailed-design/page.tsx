// 作成：Phase-15-7
// 写経レベル: 定型 ── 他の動的ページと同じ形。
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DetailedDesignPageContent } from "@/features/detailed-design/components/DetailedDesignPageContent";

// 詳細設計画面(SCR-008)。他の動的ページと同じく、params の解決だけを Server Component で行い、
// Tamagui を使う実体は Client Component に委ねる。
export default async function DetailedDesignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireAuth>
      <DetailedDesignPageContent projectId={id} />
    </RequireAuth>
  );
}
