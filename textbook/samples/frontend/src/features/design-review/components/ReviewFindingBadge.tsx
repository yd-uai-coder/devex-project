// 作成：Phase-53(完了後の調整)
"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Button, Dialog, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { BADGE } from "@/features/detailed-design/components/tableStyles";
import type { StageReviewItem } from "@/features/detailed-design/reviewMarks";
import type { FindingDecision, ReviewLevel } from "@/features/design-review/api/reviewApi";
import { CAUSE_LABEL, DECISION_LABEL, GATE_LABEL, LEVEL_LABEL } from "@/features/design-review/model";
import { useReviewStore } from "@/features/design-review/review-store";

const LEVEL_STYLE: Record<ReviewLevel, CSSProperties> = {
  critical: { color: "var(--red11)", borderColor: "var(--red8)", background: "var(--red2)" },
  major: { color: "var(--orange11)", borderColor: "var(--orange8)", background: "var(--orange2)" },
  minor: { color: "var(--color11)", borderColor: "var(--borderColor)", background: "transparent" },
};
const DECISIONS: FindingDecision[] = ["adopted", "rejected", "held"];
const SECTION: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--color10)" };

// 段階の表の行に付ける、AI 設計レビューの指摘のバッジ(却下した指摘は数えない。指摘が無ければ出さない)。
// 押すと、その行の指摘の「問題と根拠」「改善案」「判断」をダイアログで出し、採用・却下・保留を選べる
// (レビューのパネルと同じ記録)。却下した指摘はその場で外れ、残りが無くなればダイアログを閉じる。
export function ReviewFindingBadge({ projectId, items }: { projectId: string | null; items: StageReviewItem[] }) {
  const [open, setOpen] = useState(false);
  const decide = useReviewStore((s) => s.decide);
  const decidingId = useReviewStore((s) => s.decidingId);
  // 却下などで指摘が無くなったら閉じておく(後で指摘が増えても勝手に開かないように)
  const empty = items.length === 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (empty) setOpen(false);
  }, [empty]);
  if (items.length === 0 || projectId === null) return null;
  // items は重要度の順なので、先頭が最も重い
  const top = items[0].finding.level;

  return (
    <>
      <button
        type="button"
        style={{ ...BADGE, fontFamily: "inherit", whiteSpace: "nowrap", cursor: "pointer", ...LEVEL_STYLE[top] }}
        aria-label={`AI レビューの指摘 ${items.length}件`}
        title="AI 設計レビューの指摘を見る"
        onClick={() => setOpen(true)}
      >
        {`AI 指摘 ${items.length}`}
      </button>
      <Dialog modal open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay key="overlay" transition="quick" opacity={0.5} enterStyle={{ opacity: 0 }} exitStyle={{ opacity: 0 }} />
          <Dialog.Content
            key="content"
            bordered
            elevate
            gap="$3"
            padding="$5"
            maxWidth={640}
            width="90%"
            transition="quick"
            enterStyle={{ opacity: 0, scale: 0.95, y: 10 }}
            exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
          >
            <Dialog.Title size="$6">AI 設計レビューの指摘</Dialog.Title>
            <YStack gap="$4" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {items.map(({ finding: f, gate, isCurrent }, i) => (
                <YStack key={f.id} gap="$2" aria-label={`指摘${i + 1}`}>
                  <XStack gap="$2" alignItems="center" flexWrap="wrap">
                    <span style={{ ...BADGE, ...LEVEL_STYLE[f.level] }}>{LEVEL_LABEL[f.level]}</span>
                    <Text fontSize="$2">{CAUSE_LABEL[f.cause]}</Text>
                    <Text fontSize="$1" color="$color10">
                      {`${GATE_LABEL[gate]}のレビュー${isCurrent ? "" : "(段階・文書が変わる前)"}`}
                    </Text>
                  </XStack>
                  <span style={SECTION}>問題と根拠</span>
                  <Text fontSize="$2">{f.problem}</Text>
                  <Text fontSize="$1" color="$color10">{`引用: ${f.evidence}`}</Text>
                  <Text fontSize="$1" color="$color10">{`理由: ${f.reason}`}</Text>
                  <span style={SECTION}>改善案</span>
                  <Text fontSize="$2">{f.suggestion}</Text>
                  <span style={SECTION}>判断</span>
                  <XStack gap="$1" flexWrap="wrap">
                    {DECISIONS.map((d) => (
                      <Button
                        key={d}
                        size="$2"
                        theme={f.decision === d ? "blue" : undefined}
                        aria-pressed={f.decision === d}
                        aria-label={`指摘${i + 1}を${DECISION_LABEL[d]}`}
                        disabled={decidingId === f.id}
                        // 押し直すと未判断に戻す(レビューのパネルと同じ)
                        onPress={() => void decide(projectId, f.id, f.decision === d ? "pending" : d)}
                      >
                        {DECISION_LABEL[d]}
                      </Button>
                    ))}
                  </XStack>
                </YStack>
              ))}
            </YStack>
            <XStack justifyContent="flex-end">
              <StyledButton theme="gray" aria-label="閉じる" onPress={() => setOpen(false)}>
                閉じる
              </StyledButton>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </>
  );
}
