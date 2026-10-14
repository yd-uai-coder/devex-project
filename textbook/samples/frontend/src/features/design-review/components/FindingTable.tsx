// 作成：Phase-53-4｜更新：Phase-53(完了後の調整)
"use client";

// Phase-53(完了後の調整):追記 ── findingDocuments(@/features/design-review/model)
import type { CSSProperties } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { FindingDecision, ReviewFindingRead, ReviewLevel } from "@/features/design-review/api/reviewApi";
import {
  CAUSE_LABEL,
  DECISION_LABEL,
  LEVEL_LABEL,
  findingDocuments,
  sortFindings,
} from "@/features/design-review/model";
import type { TargetActionOf } from "@/features/design-review/model";

const LEVEL_COLOR: Record<ReviewLevel, string> = { critical: "var(--red10)", major: "var(--orange10)", minor: "var(--color10)" };
const DECISIONS: FindingDecision[] = ["adopted", "rejected", "held"];
const LINK: CSSProperties = { ...MONO, background: "none", border: "none", padding: 0, color: "var(--blue10)", cursor: "pointer", textAlign: "left" };

// 区切り1つ分の指摘の表(重要度の順)。対象は、飛べるものを押せるようにする。採否は押し直すと未判断に戻す。
export function FindingTable({
  findings,
  decidingId,
  targetAction,
  onDecide,
}: {
  findings: ReviewFindingRead[];
  decidingId: string | null;
  targetAction?: TargetActionOf;
  onDecide: (findingId: string, decision: FindingDecision) => void;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE} aria-label="指摘の一覧">
        <thead>
          <tr>
            {/* Phase-53(完了後の調整)：更新
            {["重要度", "原因", "対象", "問題と根拠", "改善案", "判断"].map((h) => (
            ↓↓ */}
            {["重要度", "原因", "文書", "対象", "問題と根拠", "改善案", "判断"].map((h) => (
              <th key={h} style={HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortFindings(findings).map((f, i) => (
            <tr key={f.id}>
              <td style={CELL}>
                <span style={{ ...BADGE, color: LEVEL_COLOR[f.level] }}>{LEVEL_LABEL[f.level]}</span>
              </td>
              <td style={CELL}>
                {CAUSE_LABEL[f.cause]}
                {f.point_key ? <Text fontSize="$1" color="$color10">{` 観点 ${f.point_key}`}</Text> : null}
              </td>
              {/* Phase-53(完了後の調整):追記 */}
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                <FindingDocuments finding={f} />
              </td>
              <td style={CELL}>
                <YStack gap="$1">
                  {f.targets.map((target) => {
                    const action = targetAction?.(target) ?? null;
                    return action ? (
                      <button key={target} type="button" style={LINK} title={action.label} onClick={action.onPress}>
                        {target}
                      </button>
                    ) : (
                      <span key={target} style={MONO}>
                        {target}
                      </span>
                    );
                  })}
                </YStack>
              </td>
              <td style={CELL}>
                <YStack gap="$1">
                  <Text fontSize="$2">{f.problem}</Text>
                  <Text fontSize="$1" color="$color10">{`引用: ${f.evidence}`}</Text>
                  <Text fontSize="$1" color="$color10">{`理由: ${f.reason}`}</Text>
                </YStack>
              </td>
              <td style={CELL}>{f.suggestion}</td>
              <td style={CELL}>
                <XStack gap="$1" flexWrap="wrap">
                  {DECISIONS.map((d) => (
                    <Button
                      key={d}
                      size="$1"
                      theme={f.decision === d ? "blue" : undefined}
                      aria-pressed={f.decision === d}
                      aria-label={`指摘${i + 1}を${DECISION_LABEL[d]}`}
                      disabled={decidingId === f.id}
                      onPress={() => onDecide(f.id, f.decision === d ? "pending" : d)}
                    >
                      {DECISION_LABEL[d]}
                    </Button>
                  ))}
                </XStack>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Phase-53(完了後の調整):追記
// 関連する文書の文字。推定した(レビューが文書を返す前の指摘)ときは薄く出し、推定だと分かるようにする
function FindingDocuments({ finding }: { finding: ReviewFindingRead }) {
  const { letters, inferred } = findingDocuments(finding);
  if (letters.length === 0) return <span style={{ color: "var(--color10)" }}>—</span>;
  return (
    <span
      style={{ fontWeight: 600, color: inferred ? "var(--color10)" : undefined }}
      title={inferred ? "対象の書き方から推定" : undefined}
    >
      {letters.join("・")}
    </span>
  );
}
