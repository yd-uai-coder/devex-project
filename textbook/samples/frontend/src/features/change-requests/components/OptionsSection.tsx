// 作成：Phase-107-2｜更新：Phase-107-3
"use client";

// Phase-107-3:追記 ── @/features/change-requests/components/OptionDraftReview.OptionDraftReview
import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { optionsFormFromCr, toOptionsBody } from "@/features/change-requests/changeRequestOps";
import { OptionCards } from "@/features/change-requests/components/OptionCards";
import { OptionDraftReview } from "@/features/change-requests/components/OptionDraftReview";
import { OptionsEditor } from "@/features/change-requests/components/OptionsEditor";

// 内容タブの「選択肢」の節。案ごとに名前・おすすめの印・変える要件と変更後の案・結果を出し、合意の後は
// Phase-107-3：更新
// // 選んだ案に印を付ける。下書き・説明済みの間は案を直せる(説明済みで直すと下書きに戻る。
// ↓↓
// 選んだ案に印を付ける。下書き・説明済みの間は案を直せ、LLM の下書きを作って取り込める(説明済みで直すと下書きに戻る。
// docs/external_design.md 2.16節「選択肢つきの説明」)
export function OptionsSection({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const acting = useChangeRequestsStore((s) => s.acting);
  const updateOptions = useChangeRequestsStore((s) => s.updateOptions);
  const [editing, setEditing] = useState(false);
  const editable = cr.allowed_actions.includes("edit");
  const options = cr.options;
  const chosen = cr.decision?.option ?? null;

  if (editing) {
    return (
      <YStack gap="$2" aria-label="選択肢">
        <Text fontWeight="600">選択肢(案)</Text>
        <OptionsEditor
          initial={optionsFormFromCr(options)}
          crTargets={cr.targets}
          addsRequirement={cr.adds_requirement}
          submitting={acting}
          submitLabel={cr.status === "explained" ? "案を保存する(下書きに戻る)" : "案を保存する"}
          onCancel={() => setEditing(false)}
          onSubmit={async (form) => {
            if (await updateOptions(projectId, cr.number, toOptionsBody(form))) setEditing(false);
          }}
        />
      </YStack>
    );
  }

  return (
    <YStack gap="$2" aria-label="選択肢">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Text fontWeight="600">選択肢(案)</Text>
        {editable ? (
          <Button size="$2" onPress={() => setEditing(true)}>
            {options ? "案を直す" : "案を書く"}
          </Button>
        ) : null}
      </XStack>
      {options === null ? (
        <Text color="$color11">
          案はありません。進め方が2〜3通りあるときは案を書くと、クライアントが案を選んで合意できます。
        </Text>
      ) : (
        <>
          {options.recommended !== null ? (
            <Text>{`おすすめは${options.items[options.recommended - 1]?.label ?? ""}です。理由: ${options.reason}`}</Text>
          ) : null}
          <OptionCards options={options} chosen={chosen} />
        </>
      )}
      {/* Phase-107-3:追記 */}
      {editable ? <OptionDraftReview projectId={projectId} cr={cr} /> : null}
    </YStack>
  );
}
