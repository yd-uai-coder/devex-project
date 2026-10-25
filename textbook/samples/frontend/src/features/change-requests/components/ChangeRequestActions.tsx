// 作成：Phase-87-3｜更新：Phase-88-4,107-2
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, XStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
// Phase-88-4：削除
// import { downloadExplanation } from "@/features/change-requests/api/changeRequestsApi";
import type { ChangeRequestAction, ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { ACTION_BUTTON_LABEL, changeRequestHref, headerActions } from "@/features/change-requests/changeRequestOps";
import { DecisionDialog } from "@/features/change-requests/components/DecisionDialog";
// Phase-88-4:追記
import { ExplanationDownloadButton } from "@/features/change-requests/components/ExplanationDownloadButton";
import { INPUT } from "@/features/detailed-design/components/tableStyles";
// Phase-88-4：削除
// import { saveFile } from "@/lib/api/download";

// CR の見出しの操作のボタン(許された操作だけ。docs/external_design.md 2.14節の状態)と、
// Phase-88-4：更新
// // 変更の説明書のダウンロード(どの状態でも。プレビューと要約の確認は Phase 88 の画面)。
// ↓↓
// 変更の説明書のダウンロード(どの状態でも。プレビューと要約の確認は説明書のタブ)。
// 合意・却下は記録のダイアログ、取り下げは理由を入れて確かめる。写すと写しの先の詳細へ移る。
export function ChangeRequestActions({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const router = useRouter();
  const acting = useChangeRequestsStore((s) => s.acting);
  const explain = useChangeRequestsStore((s) => s.explain);
  const decide = useChangeRequestsStore((s) => s.decide);
  const withdraw = useChangeRequestsStore((s) => s.withdraw);
  const copy = useChangeRequestsStore((s) => s.copy);
  const [dialog, setDialog] = useState<ChangeRequestAction | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  // Phase-88-4：削除
  // const [downloadError, setDownloadError] = useState<string | null>(null);
  const close = () => setDialog(null);

  const press = async (action: ChangeRequestAction) => {
    if (action === "copy") {
      const copied = await copy(projectId, cr.number);
      if (copied) router.push(changeRequestHref(projectId, copied.number));
      return;
    }
    setDialog(action);
  };

  // Phase-88-4：削除(ExplanationDownloadButton へ移した)
  // const download = async () => {
  //   setDownloadError(null);
  //   try {
  //     const file = await downloadExplanation(projectId, cr.number);
  //     saveFile(file.filename, file.content, "text/markdown");
  //   } catch (err) {
  //     setDownloadError(err instanceof Error ? err.message : "説明書をダウンロードできませんでした");
  //   }
  // };

  return (
    <XStack gap="$2" flexWrap="wrap" alignItems="center" aria-label="変更要求の操作">
      {headerActions(cr.allowed_actions).map((action) => (
        <Button
          key={action}
          size="$3"
          theme={action === "agree" ? "green" : action === "reject" || action === "withdraw" ? "red" : undefined}
          disabled={acting}
          onPress={() => void press(action)}
        >
          {ACTION_BUTTON_LABEL[action]}
        </Button>
      ))}
      {/* Phase-88-4：更新
      <Button size="$3" chromeless onPress={() => void download()}>
        説明書をダウンロード(.md)
      </Button>
      {downloadError ? (
        <span role="alert" style={{ color: "var(--red10)", fontSize: 13 }}>
          {downloadError}
        </span>
      ) : null}
      ↓↓ */}
      <ExplanationDownloadButton projectId={projectId} number={cr.number} />

      <ConfirmDialog
        open={dialog === "explain"}
        title="説明済みにする"
        description="クライアントに変更の内容と影響を説明したことを記録します。説明の後に直すと、下書きに戻ります。"
        confirmLabel="記録する"
        onCancel={close}
        onConfirm={() => {
          close();
          void explain(projectId, cr.number);
        }}
      />
      {dialog === "agree" || dialog === "reject" ? (
        <DecisionDialog
          open
          decision={dialog === "agree" ? "agreed" : "rejected"}
          // Phase-107-2:追記
          options={cr.options}
          onCancel={close}
          onConfirm={(body) => {
            close();
            void decide(projectId, cr.number, body);
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === "withdraw"}
        title="取り下げる"
        description={
          <>
            合意の前の CR を取り下げます(取り下げた CR は直せません)。
            <label style={{ display: "block", marginTop: 8, fontSize: 13 }}>
              理由(任意)
              <textarea
                style={INPUT}
                rows={2}
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
              />
            </label>
          </>
        }
        confirmLabel="取り下げを確定する"
        onCancel={close}
        onConfirm={() => {
          close();
          void withdraw(projectId, cr.number, withdrawReason.trim());
        }}
      />
    </XStack>
  );
}
