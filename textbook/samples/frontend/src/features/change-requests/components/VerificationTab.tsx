// 作成：Phase-87-4｜更新：Phase-98-2,99(完了後の調整)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type { ChangeRequestRead, MarkConfirmation } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { designStageHref, stageLabel } from "@/features/change-requests/changeRequestOps";
import type { ReviewGate } from "@/features/design-review/api/reviewApi";
import { GATE_LABEL } from "@/features/design-review/model";
import { CELL, HEAD, INPUT, TABLE } from "@/features/detailed-design/components/tableStyles";

const CONFIRMATION_COLOR: Record<MarkConfirmation, string> = {
  open: "var(--red10)",
  reviewed: "var(--green10)",
  approved: "var(--color11)",
};

const gateLabel = (gate: string) => GATE_LABEL[gate as ReviewGate] ?? gate;

// 詳細の「検証」タブ(反映の後)。反映で付いた印の今の確認の状態(未確認 / 確認済み / 承認で済んだ)を
// 段階へのリンクと一緒に出し、印の付かない文書の側(画面・API)の確認の項目をここで確認済みにする。
// Phase-98-2：更新
// // 反映の後に流したレビューを選んで結べ(任意。外せない)、未確認が0件なら検証済みにできる。
// ↓↓
// 反映の後に流したレビューを選んで結べ(任意。外せない)。CR で作り直した後にまだ承認していない段階は
// 段階へのリンクと一緒に出す。未確認が0件で、作り直した段階をすべて承認したら検証済みにできる。
// Phase-99(完了後の調整)：更新
// export function VerificationTab({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
// ↓↓
export function VerificationTab({
  projectId,
  cr,
  onStageLink,
}: {
  projectId: string;
  cr: ChangeRequestRead;
  // 詳細設計の画面のモーダルで開いたとき、段階へのリンクで画面を移らず、その段階を選ぶ
  onStageLink?: (stage: number) => void;
}) {
  const verification = useChangeRequestsStore((s) => s.views.verification);
  const candidates = useChangeRequestsStore((s) => s.views.candidates);
  const viewErrors = useChangeRequestsStore((s) => s.viewErrors);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const acting = useChangeRequestsStore((s) => s.acting);
  const checkDocuments = useChangeRequestsStore((s) => s.checkDocuments);
  const linkReview = useChangeRequestsStore((s) => s.linkReview);
  const verify = useChangeRequestsStore((s) => s.verify);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const checkable = cr.status === "applied";
  // Phase-99(完了後の調整):追記
  const stageClick = (stage: number) =>
    onStageLink
      ? (e: { preventDefault: () => void }) => {
          e.preventDefault();
          onStageLink(stage);
        }
      : undefined;

  useEffect(() => {
    if (verification === null) void fetchView(projectId, cr.number, "verification");
  }, [verification, projectId, cr.number, fetchView]);
  useEffect(() => {
    if (checkable && candidates === null) void fetchView(projectId, cr.number, "candidates");
  }, [checkable, candidates, projectId, cr.number, fetchView]);

  if (viewErrors.verification) {
    return (
      <Text role="alert" color="$red10">
        {viewErrors.verification}
      </Text>
    );
  }
  if (verification === null) return <Text color="$color11">読み込み中...</Text>;

  return (
    <YStack gap="$4">
      <Text>
        {cr.status === "verified"
          ? "検証済みです。"
          : `未確認: 段階の印 ${verification.open_marks} 件・文書の側 ${verification.open_documents} 件`}
      </Text>

      {/* Phase-98-2:追記 */}
      {verification.pending_stages.length > 0 ? (
        <YStack gap="$2" aria-label="未承認の段階">
          <Text fontWeight="600">作り直した後に未承認の段階</Text>
          <Paragraph color="$color11">
            この CR で作り直した段階です。詳細設計画面で確かめて承認すると、承認で付く印がこの CR に結ばれます。すべて承認するまで検証済みにできません。
          </Paragraph>
          {verification.pending_stages.map((stage) => (
            // Phase-99(完了後の調整)：更新
            // <Link key={stage} href={designStageHref(projectId, stage)}>
            // ↓↓
            <Link key={stage} href={designStageHref(projectId, stage)} onClick={stageClick(stage)}>
              <Text color="$blue10">{`${stageLabel(stage)} を承認する →`}</Text>
            </Link>
          ))}
        </YStack>
      ) : null}

      <YStack gap="$2" aria-label="反映で付いた印">
        <Text fontWeight="600">反映で付いた印</Text>
        <Paragraph color="$color11">
          段階の印は、詳細設計画面の段階で確かめます(承認すると印は消え、「承認で済んだ」になります)。
        </Paragraph>
        {verification.marks.length === 0 ? <Text color="$color11">印はありません。</Text> : null}
        {verification.marks.length > 0 ? (
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={HEAD}>段階</th>
                <th style={HEAD}>要素</th>
                <th style={HEAD}>理由</th>
                <th style={HEAD}>確認</th>
              </tr>
            </thead>
            <tbody>
              {verification.marks.map((mark) => (
                <tr key={`${mark.stage}:${mark.key}`}>
                  <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                    {/* Phase-99(完了後の調整)：更新 */}
                    {/* <Link href={designStageHref(projectId, mark.stage)}>{stageLabel(mark.stage)}</Link> */}
                    {/* ↓↓ */}
                    <Link href={designStageHref(projectId, mark.stage)} onClick={stageClick(mark.stage)}>
                      {stageLabel(mark.stage)}
                    </Link>
                  </td>
                  <td style={CELL}>{mark.label}</td>
                  <td style={CELL}>{mark.reason}</td>
                  <td style={{ ...CELL, whiteSpace: "nowrap", color: CONFIRMATION_COLOR[mark.confirmation] }}>
                    {mark.confirmation_label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </YStack>

      <YStack gap="$2" aria-label="文書の側の確認">
        <Text fontWeight="600">文書の側(画面・API)の確認</Text>
        <Paragraph color="$color11">
          画面と API には印が付かないので、予測に出たものを外部設計書で確かめてから、確認済みにしてください。
        </Paragraph>
        {verification.documents.length === 0 ? <Text color="$color11">確認の項目はありません。</Text> : null}
        {verification.documents.map((doc) => (
          <label key={doc.key} style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={doc.reviewed}
              disabled={!checkable || acting}
              onChange={(e) => void checkDocuments(projectId, cr.number, [doc.key], e.target.checked)}
            />{" "}
            {`${doc.label} ── ${doc.reason}`}
          </label>
        ))}
      </YStack>

      <YStack gap="$2" aria-label="結んだレビュー">
        <Text fontWeight="600">設計レビュー(任意)</Text>
        {cr.reviews.length === 0 ? <Text color="$color11">結んだレビューはありません。</Text> : null}
        {cr.reviews.map((review) => (
          <Text key={review.review_run_id} fontSize="$3">
            {`${gateLabel(review.gate)}・${review.model}(${new Date(review.started_at).toLocaleString("ja-JP")}): 指摘 ${review.findings}・採用 ${review.adopted}`}
          </Text>
        ))}
        {checkable && candidates && candidates.length > 0 ? (
          <YStack gap="$1">
            <Text fontSize="$3">反映の後に流したレビュー(選んで結ぶ。結んだレビューは外せません)</Text>
            {candidates.map((run) => (
              <XStack key={run.review_run_id} gap="$2" alignItems="center">
                <Text fontSize="$3">
                  {`${gateLabel(run.gate)}・${run.model}(${new Date(run.started_at).toLocaleString("ja-JP")}): 指摘 ${run.findings}・採用 ${run.adopted}`}
                </Text>
                <Button
                  size="$2"
                  disabled={acting}
                  onPress={() => void linkReview(projectId, cr.number, run.review_run_id)}
                >
                  結ぶ
                </Button>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>

      {checkable ? (
        <XStack>
          <Button size="$3" theme="green" disabled={!verification.can_verify || acting} onPress={() => setConfirming(true)}>
            検証済みにする
          </Button>
        </XStack>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="検証済みにする"
        description={
          <>
            反映で付いた印と文書の側の確認が済みました。検証済みにすると、新しい合意済みの版に入れられます。
            <label style={{ display: "block", marginTop: 8, fontSize: 13 }}>
              メモ(任意)
              <textarea style={INPUT} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </>
        }
        confirmLabel="検証を記録する"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void verify(projectId, cr.number, note.trim());
        }}
      />
    </YStack>
  );
}
