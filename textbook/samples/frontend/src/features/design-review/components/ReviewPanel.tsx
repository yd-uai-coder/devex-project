// 作成：Phase-53-4｜更新：Phase-53(完了後の調整)
"use client";

// Phase-53(完了後の調整):追記 ── documentLegend(@/features/design-review/model)
import { useEffect, useState } from "react";
import { Button, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { CELL, HEAD, TABLE } from "@/features/detailed-design/components/tableStyles";
import { FindingTable } from "@/features/design-review/components/FindingTable";
import type { GateStatus, ReviewGate } from "@/features/design-review/api/reviewApi";
import {
  GATE_LABEL,
  STATUS_TEXT,
  actionLabel,
  decisionCounts,
  documentLegend,
  gateDocuments,
  isRunning,
  triggerLabel,
} from "@/features/design-review/model";
import type { TargetActionOf } from "@/features/design-review/model";
import { useReviewStore } from "@/features/design-review/review-store";
import { useInterval } from "@/hooks/useInterval";

export const REVIEW_POLL_INTERVAL_MS = 5000;
// 文書・段階が変わった後に取り直す回数。生成の完了の直後は、自動のレビューの回がまだ作られていない
// ことがある(生成を完了にしてから受け付ける)ため、実行中が見えるまで数回取り直す。
export const REVIEW_REFRESH_POLLS = 3;

const STATUS_COLOR: Record<GateStatus, string> = {
  not_ready: "var(--color10)",
  unreviewed: "var(--red10)",
  running: "var(--blue10)",
  reviewed: "var(--green10)",
  failed: "var(--orange10)",
};

// AI 設計レビューのパネル(プレビュー SCR-005・作業領域 SCR-008 で共通。docs/external_design.md 2.11節)。
// superuser にだけ出す(それ以外は今の自己診断のまま)。見出しで本人がオン・オフを切り替え、オンなら
// 区切りの表(状態・レビューする / もう一度レビュー)と、区切りごとの指摘の表(採用・却下・保留)を出す。
// 実行中の区切りがあれば、区切りを取り直し続ける。`gates`で出す区切りを絞る(プレビューは文書だけ)。
// `refreshKey`(文書の版・段階の承認した版など)が変わったら取り直す。
export function ReviewPanel({
  projectId,
  gates: only,
  targetAction,
  refreshKey,
}: {
  projectId: string;
  gates?: ReviewGate[];
  targetAction?: TargetActionOf;
  refreshKey?: string;
}) {
  const me = useReviewStore((s) => s.me);
  const allGates = useReviewStore((s) => s.gates);
  const error = useReviewStore((s) => s.error);
  const savingSetting = useReviewStore((s) => s.savingSetting);
  const requesting = useReviewStore((s) => s.requesting);
  const decidingId = useReviewStore((s) => s.decidingId);
  const actionError = useReviewStore((s) => s.actionError);
  const fetchMe = useReviewStore((s) => s.fetchMe);
  const setReviewEnabled = useReviewStore((s) => s.setReviewEnabled);
  const fetchGates = useReviewStore((s) => s.fetchGates);
  const runReview = useReviewStore((s) => s.runReview);
  const decide = useReviewStore((s) => s.decide);

  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);

  const effective = me?.review_effective ?? false;
  useEffect(() => {
    if (effective) void fetchGates(projectId);
  }, [effective, projectId, fetchGates]);

  // 文書・段階が変わったら、取り直しの回数を積み直す(初めの描画では積まない)
  const [seenKey, setSeenKey] = useState(refreshKey);
  const [refreshPolls, setRefreshPolls] = useState(0);
  // Phase-53(完了後の調整):追記
  // 指摘の表を開いている区切り(初めは閉じる。見出しの件数・採否の件数は常に出す)
  const [openGates, setOpenGates] = useState<Set<ReviewGate>>(new Set());
  const toggleGate = (gate: ReviewGate) =>
    setOpenGates((prev) => {
      const next = new Set(prev);
      if (next.has(gate)) next.delete(gate);
      else next.add(gate);
      return next;
    });
  if (refreshKey !== seenKey) {
    setSeenKey(refreshKey);
    setRefreshPolls(REVIEW_REFRESH_POLLS);
  }

  const gates = only ? allGates.filter((g) => only.includes(g.gate)) : allGates;
  const detailed = allGates.length > 1;
  const running = isRunning(allGates);
  useInterval(
    () => {
      if (!running) setRefreshPolls((n) => Math.max(0, n - 1));
      void fetchGates(projectId, { force: true });
    },
    effective && (running || refreshPolls > 0) ? REVIEW_POLL_INTERVAL_MS : null,
  );

  if (!me?.is_superuser) return null;

  return (
    <YStack gap="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4" padding="$3" aria-label="AI 設計レビュー">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <H3 size="$6">AI 設計レビュー</H3>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={me.review_enabled}
            disabled={savingSetting}
            onChange={(e) => void setReviewEnabled(e.target.checked)}
          />{" "}
          AI 設計レビューを使う
        </label>
        {!effective ? (
          <Text fontSize="$2" color="$color10">
            オフ(生成の後は、今の自己診断をチャットに出します)
          </Text>
        ) : null}
      </XStack>

      {actionError ? (
        <Text role="alert" fontSize="$2" color="$red10">
          {actionError}
        </Text>
      ) : null}

      {effective && error ? (
        <Text role="alert" fontSize="$2" color="$red10">
          {error}
        </Text>
      ) : null}

      {effective && gates.length > 0 ? (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE} aria-label="レビューの区切り">
              <thead>
                <tr>
                  {["区切り", "流し方", "渡す文書", "状態", "操作"].map((h) => (
                    <th key={h} style={HEAD}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gates.map((g) => {
                  const label = actionLabel(g.status);
                  return (
                    <tr key={g.gate}>
                      <td style={CELL}>{GATE_LABEL[g.gate]}</td>
                      <td style={CELL}>{triggerLabel(g.gate)}</td>
                      <td style={CELL}>{gateDocuments(g.gate, detailed)}</td>
                      <td style={CELL}>
                        <span style={{ color: STATUS_COLOR[g.status], fontSize: 12, fontWeight: 600 }}>
                          {STATUS_TEXT[g.status]}
                        </span>
                      </td>
                      <td style={CELL}>
                        {label ? (
                          <Button
                            size="$1"
                            disabled={requesting !== null || isRunning(allGates)}
                            aria-label={`${GATE_LABEL[g.gate]}を${label}`}
                            onPress={() => void runReview(projectId, g.gate)}
                          >
                            {label}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {gates.map((g) => {
            if (!g.run || g.run.status !== "succeeded") return null;
            const counts = decisionCounts(g.run.findings);
            // Phase-53(完了後の調整):追記
            const open = openGates.has(g.gate);
            return (
              <YStack key={g.gate} gap="$2" aria-label={`${GATE_LABEL[g.gate]}の指摘`}>
                {/* Phase-53(完了後の調整)：更新
                <Text fontWeight="600">{`${GATE_LABEL[g.gate]}の指摘 ${g.run.findings.length}件`}</Text>
                ↓↓ */}
                <XStack gap="$2" alignItems="center">
                  <Button
                    size="$1"
                    chromeless
                    aria-expanded={open}
                    aria-label={`${GATE_LABEL[g.gate]}の指摘を${open ? "閉じる" : "開く"}`}
                    onPress={() => toggleGate(g.gate)}
                  >
                    {open ? "▼" : "▶"}
                  </Button>
                  <Text fontWeight="600">{`${GATE_LABEL[g.gate]}の指摘 ${g.run.findings.length}件`}</Text>
                </XStack>
                <Paragraph fontSize="$2" color="$color10">
                  {`採用 ${counts.adopted} ・ 却下 ${counts.rejected} ・ 保留 ${counts.held} ・ 未判断 ${counts.pending}`}
                  {g.run.is_current ? "" : " ── 文書・段階が変わる前のレビューです(もう一度レビューすると今の版を見ます)"}
                </Paragraph>
                {/* Phase-53(完了後の調整)：更新
                {g.run.findings.length > 0 ? (
                ↓↓ */}
                {open && g.run.findings.length > 0 ? (
                  <Text fontSize="$1" color="$color10" aria-label="文書の凡例">
                    {`文書: ${documentLegend(g.gate)
                      .map((d) => `${d.letter} ${d.label}`)
                      .join("　")}`}
                  </Text>
                ) : null}
                {!open ? null : g.run.findings.length > 0 ? (
                  <FindingTable
                    findings={g.run.findings}
                    decidingId={decidingId}
                    targetAction={targetAction}
                    onDecide={(findingId, decision) => void decide(projectId, findingId, decision)}
                  />
                ) : (
                  <Text fontSize="$2" color="$color10">
                    指摘はありません。
                  </Text>
                )}
              </YStack>
            );
          })}
        </>
      ) : null}
    </YStack>
  );
}
