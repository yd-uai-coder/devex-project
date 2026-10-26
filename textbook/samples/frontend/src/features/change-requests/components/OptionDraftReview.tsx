// 作成：Phase-107-3｜更新：Phase-110(完了後の調整)
"use client";

// Phase-110(完了後の調整):追記 ── @/features/change-requests/changeRequestOps.draftStaleNotice
import { useEffect, useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { draftStaleNotice } from "@/features/change-requests/changeRequestOps";
import { OptionCards } from "@/features/change-requests/components/OptionCards";

// 選択肢の LLM の下書き(任意)。説明書の md から LLM が2〜3の案とおすすめを作り、未確認のまま出す
// (説明書には載らない)。取り込めない問題(案の規則・CR の対象に無い要件)があれば取り込みを止め、
// 説明書に無い要件 ID・数字は知らせるだけにする。取り込むと CR の案になり、そのあとは手で直せる
// (docs/external_design.md 2.16節「選択肢つきの説明」)
export function OptionDraftReview({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const view = useChangeRequestsStore((s) => s.views.optionDraft);
  const error = useChangeRequestsStore((s) => s.viewErrors.optionDraft);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const draftActing = useChangeRequestsStore((s) => s.draftActing);
  const draftError = useChangeRequestsStore((s) => s.draftError);
  const draftOptions = useChangeRequestsStore((s) => s.draftOptions);
  const adoptDraft = useChangeRequestsStore((s) => s.adoptDraft);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (view === null) void fetchView(projectId, cr.number, "optionDraft");
  }, [view, projectId, cr.number, fetchView]);

  const draft = view?.draft ?? null;
  const unknown = draft ? [...draft.unknown_requirement_ids, ...draft.unknown_numbers] : [];

  return (
    <YStack gap="$2" padding="$3" backgroundColor="$color2" borderRadius="$3" aria-label="選択肢の下書き">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Text fontWeight="600">LLM の下書き(任意)</Text>
        <Button size="$2" disabled={draftActing !== null} onPress={() => void draftOptions(projectId, cr.number)}>
          {draftActing === "create" ? "下書きを作成中..." : draft ? "下書きを作り直す" : "LLM で下書きを作る"}
        </Button>
      </XStack>
      <Paragraph color="$color11" size="$2">
        説明書から LLM(生成の用途のモデル)で案を作ります。下書きは説明書に載らず、確かめて取り込むと CR の案になります。
      </Paragraph>
      {error ? (
        <Text role="alert" color="$red10">
          {error}
        </Text>
      ) : null}
      {draftError ? (
        <Text role="alert" color="$red10">
          {draftError}
        </Text>
      ) : null}
      {view === null && !error ? <Text color="$color11">読み込み中...</Text> : null}
      {draft ? (
        <YStack gap="$2">
          <Text fontSize="$2" color="$color11">
            {`${draft.status_label} ・${new Date(draft.generated_at).toLocaleString("ja-JP")} に作成`}
            {draft.generated_model ? ` ・${draft.generated_model}` : ""}
          </Text>
          {/* Phase-110(完了後の調整)：更新 */}
          {/* {draft.stale ? ( */}
          {/* ↓↓ */}
          {draftStaleNotice(draft) ? (
            <Text color="$orange10">作った後に説明書が変わりました。作り直すと、今の説明書から案を作ります。</Text>
          ) : null}
          {draft.problems.length > 0 ? (
            <YStack role="alert" aria-label="取り込めない理由">
              <Text color="$red10">取り込めません:</Text>
              {draft.problems.map((p) => (
                <Text key={p} color="$red10">
                  {`・${p}`}
                </Text>
              ))}
            </YStack>
          ) : null}
          {unknown.length > 0 ? (
            <Text color="$orange10">{`説明書に無い要件 ID・数字があります(人が確かめてください): ${unknown.join("、")}`}</Text>
          ) : null}
          {draft.options.recommended !== null ? (
            <Text>{`おすすめ: ${draft.options.items[draft.options.recommended - 1]?.label ?? ""}(理由: ${draft.options.reason})`}</Text>
          ) : null}
          <OptionCards options={draft.options} />
          {draft.status === "unconfirmed" ? (
            <XStack>
              <Button
                size="$3"
                theme="green"
                disabled={!draft.adoptable || draftActing !== null}
                onPress={() => setConfirming(true)}
              >
                {draftActing === "adopt" ? "取り込み中..." : "下書きを取り込む"}
              </Button>
            </XStack>
          ) : null}
        </YStack>
      ) : view !== null ? (
        <Text color="$color11">下書きはありません。</Text>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="下書きを取り込む"
        description={
          cr.status === "explained"
            ? "今の案を下書きの案で置き換えます。説明済みの CR は下書きに戻ります。"
            : "今の案を下書きの案で置き換えます。"
        }
        confirmLabel="取り込む"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void adoptDraft(projectId, cr.number);
        }}
      />
    </YStack>
  );
}
