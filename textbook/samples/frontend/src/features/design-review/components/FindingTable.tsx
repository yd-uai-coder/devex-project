// 作成：Phase-53-4｜更新：Phase-53(完了後の調整),54-1,54-5
"use client";

// Phase-53(完了後の調整):追記 ── findingDocuments(@/features/design-review/model)
// Phase-54-1:追記 ── @/features/design-review/api/reviewApi.FixCheckRead, @/features/design-review/api/reviewApi.FollowupState, @/features/design-review/model.FOLLOWUP_LABEL, @/features/design-review/model.fixCheckText
import type { CSSProperties } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
// Phase-54-1：更新
// import type { FindingDecision, ReviewFindingRead, ReviewLevel } from "@/features/design-review/api/reviewApi";
// ↓↓
import type {
  FindingDecision,
  FixCheckRead,
  FollowupState,
  ReviewFindingRead,
  ReviewLevel,
} from "@/features/design-review/api/reviewApi";
import {
  CAUSE_LABEL,
  DECISION_LABEL,
  // Phase-54-1:追記
  FOLLOWUP_LABEL,
  LEVEL_LABEL,
  // Phase-54-1:追記
  fixCheckText,
  findingDocuments,
  sortFindings,
} from "@/features/design-review/model";
import type { TargetActionOf } from "@/features/design-review/model";

const LEVEL_COLOR: Record<ReviewLevel, string> = { critical: "var(--red10)", major: "var(--orange10)", minor: "var(--color10)" };
const DECISIONS: FindingDecision[] = ["adopted", "rejected", "held"];
// Phase-54-1:追記
export const FOLLOWUP_STYLE: Record<FollowupState, CSSProperties> = {
  unaddressed: { color: "var(--red11)", borderColor: "var(--red8)", background: "var(--red2)" },
  target_unchanged: { color: "var(--orange11)", borderColor: "var(--orange8)", background: "var(--orange2)" },
  changed: { color: "var(--color10)", borderColor: "var(--borderColor)", background: "transparent" },
};
const LINK: CSSProperties = { ...MONO, background: "none", border: "none", padding: 0, color: "var(--blue10)", cursor: "pointer", textAlign: "left" };

// 区切り1つ分の指摘の表(重要度の順)。対象は、飛べるものを押せるようにする。採否は押し直すと未判断に戻す。
// Phase-54-1:追記
// 採用した指摘には、直したかの追跡(未対応・対象が変わっていない・変更あり)を判断の下に出す。
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
                // Phase-54-1:追記
                {f.followup ? <FollowupChip state={f.followup} /> : null}
                {f.fix_check ? <FixCheckNote check={f.fix_check} /> : null}
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

// Phase-54-1:追記
// 採用した指摘の追跡のチップ
export function FollowupChip({ state }: { state: FollowupState }) {
  return (
    <span
      style={{ ...BADGE, display: "inline-block", marginTop: 4, ...FOLLOWUP_STYLE[state] }}
      aria-label={`追跡: ${FOLLOWUP_LABEL[state]}`}
    >
      {FOLLOWUP_LABEL[state]}
    </span>
  );
}

// 「直ったか」の判定(シャドーモード。理由は title で出す)
export function FixCheckNote({ check }: { check: FixCheckRead }) {
  return (
    <span
      style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--color10)" }}
      title={check.reason || check.error_code || undefined}
    >
      {fixCheckText(check)}
    </span>
  );
}
