// 作成：Phase-116-2｜更新：Phase-116-3
"use client";

// Phase-116-3:追記 ── tamagui.H3, @/features/materials/components/DifferenceTable.DifferenceTable, @/features/materials/components/ExtractionPanel.ExtractionPanel
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { DetailedModeOnlyNotice } from "@/features/change-requests/components/DetailedModeOnlyNotice";
import { useMaterialsStore } from "@/features/materials/materials-store";
import { MATERIAL_KIND_LABEL, MATERIAL_SOURCE_LABEL, materialsHref } from "@/features/materials/materialOps";
import { DifferenceTable } from "@/features/materials/components/DifferenceTable";
import { ExtractionPanel } from "@/features/materials/components/ExtractionPanel";

const BODY = {
  margin: 0,
  whiteSpace: "pre-wrap",
  fontSize: 13,
  maxHeight: 320,
  overflowY: "auto",
  padding: 8,
  border: "1px solid var(--borderColor)",
  borderRadius: 4,
} as const;

// Phase-116-3：更新
// // 資料1件のページ(SCR-013)。見出しに種類・日付・出どころ、本文(長いときは枠の中で送る)。
// ↓↓
// 資料1件のページ(SCR-013)。見出しに種類・日付・出どころ、本文(長いときは枠の中で送る)、違いの取り出しと
// 違いの一覧(選んで CR の下書きへ)。
// 消すと、その資料から取り出した違いも消える(作った CR は残る)ので、確かめてから消す。
export function MaterialDetailContent({ projectId, materialId }: { projectId: string; materialId: string }) {
  const router = useRouter();
  const detail = useMaterialsStore((s) => (s.projectId === projectId && s.detail?.id === materialId ? s.detail : null));
  const detailStatus = useMaterialsStore((s) => s.detailStatus);
  const detailError = useMaterialsStore((s) => s.detailError);
  const detailNotFound = useMaterialsStore((s) => s.detailNotFound);
  const unavailable = useMaterialsStore((s) => s.unavailable && s.projectId === projectId);
  const acting = useMaterialsStore((s) => s.acting);
  const actionError = useMaterialsStore((s) => s.actionError);
  const fetchDetail = useMaterialsStore((s) => s.fetchDetail);
  const remove = useMaterialsStore((s) => s.remove);
  // Phase-116-3:追記
  const differences = useMaterialsStore((s) =>
    s.projectId === projectId && s.differences?.material_id === materialId ? s.differences : null,
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    void fetchDetail(projectId, materialId);
  }, [projectId, materialId, fetchDetail]);

  const back = (
    <Link href={materialsHref(projectId)}>
      <Text color="$blue10">← 資料の一覧</Text>
    </Link>
  );

  if (unavailable) return <DetailedModeOnlyNotice projectId={projectId} title="資料" />;
  if (detailNotFound) {
    return (
      <YStack paddingVertical="$4" gap="$3">
        <H2>資料が見つかりません</H2>
        {back}
      </YStack>
    );
  }

  return (
    <YStack paddingVertical="$4" gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>{detail ? detail.title : "資料"}</H2>
        <XStack gap="$3" alignItems="center">
          {back}
          <Link href={`/projects/${projectId}/change-requests`}>
            <Text color="$blue10">変更要求(CR)</Text>
          </Link>
        </XStack>
      </XStack>

      {detailStatus === "loading" && detail === null ? <Text color="$color11">読み込み中...</Text> : null}
      {detailStatus === "error" ? (
        <Text role="alert" color="$red10">
          {detailError}
        </Text>
      ) : null}
      {actionError ? (
        <Text role="alert" color="$red10">
          {actionError}
        </Text>
      ) : null}

      {detail ? (
        <>
          <Text color="$color11">
            {`${MATERIAL_KIND_LABEL[detail.kind]}・${detail.material_date}・${
              detail.filename ? `${MATERIAL_SOURCE_LABEL[detail.source]}(${detail.filename})` : MATERIAL_SOURCE_LABEL[detail.source]
            }・${detail.length}文字`}
          </Text>
          <YStack gap="$1">
            <Text fontWeight="bold">本文</Text>
            <pre style={BODY} aria-label="資料の本文">
              {detail.body}
            </pre>
          </YStack>

          {/* Phase-116-3:追記 */}
          {differences ? (
            <YStack gap="$3">
              <H3>違いの一覧</H3>
              <ExtractionPanel projectId={projectId} materialId={materialId} view={differences} />
              <DifferenceTable projectId={projectId} materialId={materialId} view={differences} />
            </YStack>
          ) : null}

          {confirmingDelete ? (
            <YStack gap="$2" padding="$3" borderWidth={1} borderColor="$red8" borderRadius="$4">
              <Paragraph>
                この資料と、資料から取り出した違いを消します。違いから作った変更要求は残ります。消しますか?
              </Paragraph>
              <XStack gap="$2">
                <Button
                  size="$3"
                  theme="red"
                  disabled={acting}
                  onPress={async () => {
                    if (await remove(projectId, materialId)) router.push(materialsHref(projectId));
                  }}
                >
                  消す
                </Button>
                <Button size="$3" chromeless onPress={() => setConfirmingDelete(false)}>
                  やめる
                </Button>
              </XStack>
            </YStack>
          ) : (
            <XStack>
              <Button size="$2" chromeless onPress={() => setConfirmingDelete(true)}>
                この資料を消す
              </Button>
            </XStack>
          )}
        </>
      ) : null}
    </YStack>
  );
}
