// 作成：Phase-88-3｜更新：Phase-116-4
import { RequireAuth } from "@/components/auth/RequireAuth";
import { BaselinesPageContent } from "@/features/baselines/components/BaselinesPageContent";

// 合意済みの版(束)の一覧と作成(SCR-010)。他の動的ページと同じく、params の解決だけを Server Component で
// Phase-116-4：更新
// // 行い、Tamagui を使う実体は Client Component に委ねる。
// export default async function BaselinesPage({ params }: { params: Promise<{ id: string }> }) {
// ↓↓
// 行い、Tamagui を使う実体は Client Component に委ねる。?create=1 は作成のフォームを開いて始める
// (束が古いときの知らせからの案内)。
export default async function BaselinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // Phase-116-4:追記
  const { create } = await searchParams;
  return (
    <RequireAuth>
      {/* Phase-116-4：更新 */}
      {/* <BaselinesPageContent projectId={id} /> */}
      {/* ↓↓ */}
      <BaselinesPageContent projectId={id} initialCreate={create === "1"} />
    </RequireAuth>
  );
}
