// 作成：Phase-87-3｜更新：Phase-112-2
// Phase-112-2:追記 ── @/features/change-requests/changeRequestOps.detailTabOf
import { RequireAuth } from "@/components/auth/RequireAuth";
import { detailTabOf } from "@/features/change-requests/changeRequestOps";
import { ChangeRequestDetailContent } from "@/features/change-requests/components/ChangeRequestDetailContent";

// 変更要求(CR)の詳細(SCR-010)。params の解決だけを Server Component で行い、番号を数にして渡す。
// Phase-112-2:追記
// ?tab= は開くタブ、?focus= は影響のタブの反映の前 → 後で目立たせる要素のキー(確認事項からのリンク)。
export default async function ChangeRequestDetailPage({
  params,
  // Phase-112-2:追記
  searchParams,
}: {
  params: Promise<{ id: string; number: string }>;
  // Phase-112-2:追記
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id, number } = await params;
  // Phase-112-2:追記
  const { tab, focus } = await searchParams;
  return (
    <RequireAuth>
      {/* Phase-112-2：更新 */}
      {/* <ChangeRequestDetailContent projectId={id} number={Number(number)} /> */}
      {/* ↓↓ */}
      <ChangeRequestDetailContent
        projectId={id}
        number={Number(number)}
        initialTab={detailTabOf(typeof tab === "string" ? tab : undefined)}
        focusKey={typeof focus === "string" ? focus : null}
      />
    </RequireAuth>
  );
}
