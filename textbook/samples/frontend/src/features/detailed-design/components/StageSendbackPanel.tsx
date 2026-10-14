// 作成：Phase-54-3
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { STAGE_TITLES } from "@/features/detailed-design/labels";
import { sendbackArgs, sendbackStage } from "@/features/detailed-design/sendbackOps";
import type { ReviewFindingRead } from "@/features/design-review/api/reviewApi";
import { LEVEL_LABEL, regenerableFindings } from "@/features/design-review/model";
import { useReviewStore } from "@/features/design-review/review-store";

// 作り直せる段階(詳細設計モードの段階1〜7。段階8 の手順書はレビューの対象にしない)
const SENDBACK_STAGES = [1, 2, 3, 4, 5, 6, 7];

// 差し戻し(作業領域): 段階6・7 の区切りの採用した設計・不整合の指摘を修正指示にして、段階を作り直す。
// 作り直す段階は指摘の対象から推定した段階を初期値にし、選び直せる。段階5・6 は部分再生成なので、
// 指摘の対象から作り直す行を決める(決まらなければ作り直せないと知らせる)。作り直した後は、今の流れ
// (確かめて承認し直す → 段階の区切りが未レビューになる → ボタンでレビュー)のまま。
export function StageSendbackPanel({ projectId }: { projectId: string }) {
  const stages = useDetailedDesignStore((s) => s.stages);
  const requesting = useDetailedDesignStore((s) => s.requestingGeneration);
  const generate = useDetailedDesignStore((s) => s.generate);
  const selectStage = useDetailedDesignStore((s) => s.selectStage);
  const reviewEffective = useReviewStore((s) => s.me?.review_effective ?? false);
  const gates = useReviewStore((s) => s.gates);
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<number | null>(null);
  const [findingIds, setFindingIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const findings: ReviewFindingRead[] = gates
    .filter((g) => g.gate !== "documents")
    .flatMap((g) => regenerableFindings(g));
  if (!reviewEffective || findings.length === 0) return null;
  const candidates = stages.filter((s) => SENDBACK_STAGES.includes(s.stage));
  const chosen = findings.filter((f) => findingIds.includes(f.id));
  const unaddressed = findings.filter((f) => f.followup === "unaddressed");

  const start = () => {
    const initial = unaddressed.length > 0 ? unaddressed : findings;
    setFindingIds(initial.map((f) => f.id));
    setStage(sendbackStage(initial, stages) ?? candidates[0]?.stage ?? null);
    setError(null);
    setOpen(true);
  };
  const confirm = () => {
    if (stage === null || chosen.length === 0) {
      setError("作り直す段階と、指示に入れる指摘を選んでください。");
      return;
    }
    const args = sendbackArgs(stage, chosen, stages);
    if (args === null) {
      setError(`段階${stage}で作り直す行を、選んだ指摘の対象から決められません。ほかの段階を選んでください。`);
      return;
    }
    setOpen(false);
    selectStage(stage);
    void generate(projectId, stage, args.functionIds, args.logics, args.unitIds, findingIds);
  };

  return (
    <YStack gap="$2" aria-label="採用した指摘で段階を作り直す">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button size="$2" disabled={requesting} onPress={start}>
          {`採用した指摘で段階を作り直す(${findings.length}件)`}
        </Button>
        <Text fontSize="$2" color="$color10">
          段階6・7 のレビューで採用した設計・不整合の指摘を、AI の作り直しの指示に入れます。
        </Text>
      </XStack>
      <ConfirmDialog
        open={open}
        title="採用した指摘で段階を作り直しますか"
        description={
          // 説明は段落の中に出るので、ブロック要素を入れず、ラベルの表示だけを行にする
          <>
            作り直す段階と、指示に入れる指摘を選んでください。指摘に関係しない行はそのまま残すよう指示します。作り直した後は、内容を確かめて承認し直してください。
            <span style={{ display: "block", marginTop: 8, fontWeight: 600 }}>作り直す段階</span>
            {candidates.map((s) => (
              <label key={s.stage} style={{ display: "block", marginTop: 4 }}>
                <input
                  type="radio"
                  name="sendback-stage"
                  checked={stage === s.stage}
                  disabled={!s.is_open}
                  onChange={() => {
                    setStage(s.stage);
                    setError(null);
                  }}
                />{" "}
                {`段階${s.stage}-${STAGE_TITLES[s.stage] ?? ""}`}
              </label>
            ))}
            <span style={{ display: "block", marginTop: 8, fontWeight: 600 }}>指示に入れる指摘</span>
            {findings.map((f) => (
              <label key={f.id} style={{ display: "block", marginTop: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={findingIds.includes(f.id)}
                  onChange={(e) =>
                    setFindingIds((ids) => (e.target.checked ? [...ids, f.id] : ids.filter((id) => id !== f.id)))
                  }
                />{" "}
                {`[${LEVEL_LABEL[f.level]}] ${f.problem}`}
                {f.followup === "unaddressed" ? <span style={{ color: "var(--red10)" }}>(未対応)</span> : null}
              </label>
            ))}
            {error ? (
              <span role="alert" style={{ display: "block", marginTop: 8, color: "var(--red10)" }}>
                {error}
              </span>
            ) : null}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </YStack>
  );
}
