// 作成：Phase-99(完了後の調整)
"use client";

import { useEffect } from "react";
import { Dialog, ScrollView, Text, XStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { VerificationTab } from "@/features/change-requests/components/VerificationTab";

// 詳細設計の画面で開く CR の検証のモーダル。CR の詳細の「検証」タブ(VerificationTab)をそのまま出し、
// 印の状態・文書の側の確認・未承認の段階・検証済みにする、を画面を移らずに行う。段階へのリンクは
// モーダルを閉じてその段階を選ぶ。閉じたら onClose(帯と CR の一覧を読み直す)。
export function ChangeRequestVerifyDialog({
  projectId,
  number,
  onClose,
  onSelectStage,
}: {
  projectId: string;
  // 開いている CR の番号(閉じているときは null)
  number: number | null;
  onClose: () => void;
  onSelectStage: (stage: number) => void;
}) {
  const detail = useChangeRequestsStore((s) => s.detail);
  const detailError = useChangeRequestsStore((s) => s.detailError);
  const fetchDetail = useChangeRequestsStore((s) => s.fetchDetail);

  useEffect(() => {
    if (number !== null) void fetchDetail(projectId, number);
  }, [projectId, number, fetchDetail]);

  const cr = number !== null && detail?.number === number ? detail : null;
  return (
    <Dialog modal open={number !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay key="overlay" transition="quick" opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
        <Dialog.Content
          key="content"
          bordered
          elevate
          gap="$3"
          padding="$4"
          width="90%"
          maxWidth={960}
          maxHeight="85vh"
          transition="quick"
          enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
        >
          <Dialog.Title size="$6">{number !== null ? `CR-${number} の検証` : ""}</Dialog.Title>
          <Dialog.Description size="$2" color="$color11">
            {cr ? cr.title : ""}
          </Dialog.Description>
          <ScrollView flexShrink={1}>
            {detailError && cr === null ? (
              <Text role="alert" color="$red10">
                {detailError}
              </Text>
            ) : cr ? (
              <VerificationTab
                projectId={projectId}
                cr={cr}
                onStageLink={(stage) => {
                  onSelectStage(stage);
                  onClose();
                }}
              />
            ) : (
              <Text color="$color11">読み込み中...</Text>
            )}
          </ScrollView>
          <XStack justifyContent="flex-end">
            <StyledButton theme="gray" aria-label="閉じる" onPress={onClose}>
              閉じる
            </StyledButton>
          </XStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
