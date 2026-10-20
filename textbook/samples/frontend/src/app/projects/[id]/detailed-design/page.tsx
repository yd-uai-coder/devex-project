// 作成：Phase-15-7｜更新：Phase-87-4
// 写経レベル: 定型 ── 他の動的ページと同じ形。
// Phase-87-4:追記 ── @/features/detailed-design/labels.stageParam
import { RequireAuth } from "@/components/auth/RequireAuth";
import { DetailedDesignPageContent } from "@/features/detailed-design/components/DetailedDesignPageContent";
import { stageParam } from "@/features/detailed-design/labels";

// 詳細設計画面(SCR-008)。他の動的ページと同じく、params の解決だけを Server Component で行い、
// Phase-87-4：更新
// // Tamagui を使う実体は Client Component に委ねる。
// ↓↓
// Tamagui を使う実体は Client Component に委ねる。`?stage=N` で開く段階を選べる(変更要求の画面から
// 段階の印を確かめに来るリンク)。
export default async function DetailedDesignPage({
  params,
  // Phase-87-4:追記
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // Phase-87-4:追記
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  // Phase-87-4:追記
  const { stage } = await searchParams;
  return (
    <RequireAuth>
      {/* Phase-87-4：更新
      <DetailedDesignPageContent projectId={id} />
      ↓↓ */}
      <DetailedDesignPageContent projectId={id} initialStage={stageParam(stage)} />
    </RequireAuth>
  );
}
