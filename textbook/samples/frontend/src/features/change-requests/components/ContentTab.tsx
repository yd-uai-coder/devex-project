// 作成：Phase-87-3｜更新：Phase-88-3,98-2,107-1,107-2,112-4
"use client";

// Phase-88-3:追記
// Phase-107-1:追記 ── @/features/change-requests/components/ScaleTable.ScaleTable
// Phase-107-2:追記 ── @/features/change-requests/changeRequestOps.decidedOptionLabel, @/features/change-requests/components/OptionsSection.OptionsSection
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import {
  changeRequestHref,
  decidedOptionLabel,
  formFromChangeRequest,
  toUpdateBody,
} from "@/features/change-requests/changeRequestOps";
import { ChangeRequestForm } from "@/features/change-requests/components/ChangeRequestForm";
import { OptionsSection } from "@/features/change-requests/components/OptionsSection";
import { ScaleTable } from "@/features/change-requests/components/ScaleTable";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { baselineHref } from "@/features/baselines/baselineOps";

// Phase-98-2：更新
// // 詳細の「内容」タブ。内容・背景・対象(種類と変更後の案)・合意の記録・重なり・写しの元と先・
// ↓↓
// Phase-107-1：更新
// // 詳細の「内容」タブ。内容・背景・対象(種類と変更後の案)・新しい要件の予測の起点・合意の記録・重なり・写しの元と先・
// // 入れた合意済みの版を出す。下書き・説明済みの間は直せる(説明済みで直すと下書きに戻る)。
// ↓↓
// Phase-107-2：更新
// // 詳細の「内容」タブ。内容・背景・対象(種類と変更後の案)・新しい要件の予測の起点・変更の規模・合意の記録・重なり・
// // 写しの元と先・入れた合意済みの版を出す。規模は説明書と同じ数なので、説明書のビューを読む。下書き・説明済みの間は直せる(説明済みで直すと下書きに戻る)。
// ↓↓
// 詳細の「内容」タブ。内容・背景・対象(種類と変更後の案)・新しい要件の予測の起点・選択肢(案)・変更の規模・
// 合意の記録・重なり・写しの元と先・入れた合意済みの版を出す。規模は説明書と同じ数なので、説明書のビューを読む。下書き・説明済みの間は直せる(説明済みで直すと下書きに戻る)。
export function ContentTab({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const requirements = useChangeRequestsStore((s) => s.requirements[cr.baseline_number] ?? null);
  const fetchRequirements = useChangeRequestsStore((s) => s.fetchRequirements);
  // Phase-98-2:追記
  const origins = useChangeRequestsStore((s) => s.origins[cr.baseline_number] ?? null);
  const fetchOrigins = useChangeRequestsStore((s) => s.fetchOrigins);
  // Phase-107-1:追記
  const explanation = useChangeRequestsStore((s) => s.views.explanation);
  const explanationError = useChangeRequestsStore((s) => s.viewErrors.explanation);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const acting = useChangeRequestsStore((s) => s.acting);
  const update = useChangeRequestsStore((s) => s.update);
  const [editing, setEditing] = useState(false);
  const editable = cr.allowed_actions.includes("edit");

  // 対象の合意済みの文を出すため、基準の束の要件を読む
  useEffect(() => {
    void fetchRequirements(projectId, cr.baseline_number);
  }, [projectId, cr.baseline_number, fetchRequirements]);
  const textOf = (id: string) => requirements?.find((r) => r.id === id)?.text ?? "";
  // Phase-107-1:追記
  useEffect(() => {
    if (explanation === null) void fetchView(projectId, cr.number, "explanation");
  }, [explanation, projectId, cr.number, fetchView]);
  // Phase-98-2:追記
  // 起点の候補は直すときだけ要る
  useEffect(() => {
    if (editing) void fetchOrigins(projectId, cr.baseline_number);
  }, [editing, projectId, cr.baseline_number, fetchOrigins]);

  if (editing) {
    return (
      <ChangeRequestForm
        initial={formFromChangeRequest(cr)}
        requirements={requirements}
        // Phase-98-2:追記
        origins={origins}
        submitting={acting}
        submitLabel={cr.status === "explained" ? "直す(下書きに戻る)" : "直す"}
        onCancel={() => setEditing(false)}
        onSubmit={async (form) => {
          if (await update(projectId, cr.number, toUpdateBody(form))) setEditing(false);
        }}
      />
    );
  }

  return (
    <YStack gap="$3">
      {editable ? (
        <XStack>
          <Button size="$3" onPress={() => setEditing(true)}>
            内容を直す
          </Button>
        </XStack>
      ) : null}
      <YStack gap="$1">
        <Text fontWeight="600">内容</Text>
        <Paragraph whiteSpace="pre-wrap">{cr.content}</Paragraph>
      </YStack>
      <YStack gap="$1">
        <Text fontWeight="600">背景</Text>
        <Text>
          {cr.background_source_label}
          {cr.background_date ? `(${cr.background_date})` : ""}
        </Text>
        {cr.background_memo ? <Paragraph whiteSpace="pre-wrap">{cr.background_memo}</Paragraph> : null}
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="600">{`対象の要件(基準: ${cr.baseline_label})`}</Text>
        {cr.targets.length > 0 ? (
          <table style={TABLE} aria-label="対象の要件">
            <thead>
              <tr>
                <th style={HEAD}>要件</th>
                <th style={HEAD}>変更の種類</th>
                <th style={HEAD}>合意済みの文</th>
                <th style={HEAD}>変更後の案</th>
              </tr>
            </thead>
            <tbody>
              {cr.targets.map((t) => (
                <tr key={t.requirement_id}>
                  <td style={{ ...CELL, ...MONO }}>{t.requirement_id}</td>
                  <td style={CELL}>{t.kind_label}</td>
                  <td style={CELL}>{textOf(t.requirement_id)}</td>
                  <td style={CELL}>{t.kind === "delete" ? "(削除)" : t.proposed_text || "(内容を参照)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {/* Phase-98-2：更新 */}
        {/* {cr.adds_requirement ? <Text>新しい要件を足す(ID の無い要件。影響の予測には入りません)</Text> : null} */}
        {/* ↓↓ */}
        {cr.adds_requirement ? (
          <YStack gap="$1" aria-label="予測の起点">
            <Text>新しい要件を足す(ID の無い要件)</Text>
            {cr.origins.length > 0 ? (
              <Text fontSize="$3">{`予測の起点: ${cr.origins.map((o) => o.label).join("、")}`}</Text>
            ) : (
              <Text fontSize="$3" color="$color11">
                予測の起点を選んでいないので、新しい要件の分は影響の予測に入りません。
              </Text>
            )}
          </YStack>
        ) : null}
      </YStack>

      {/* Phase-107-2:追記 */}
      <OptionsSection projectId={projectId} cr={cr} />

      {/* Phase-107-1:追記 */}
      <YStack gap="$1" aria-label="変更の規模">
        <Text fontWeight="600">変更の規模</Text>
        {explanationError ? (
          <Text role="alert" color="$red10">
            {explanationError}
          </Text>
        ) : explanation === null ? (
          <Text color="$color11">読み込み中...</Text>
        ) : (
          <ScaleTable explanation={explanation} />
        )}
      </YStack>

      {cr.decision ? (
        <YStack gap="$1" aria-label="合意の記録">
          <Text fontWeight="600">{`${cr.status === "rejected" ? "却下" : "合意"}の記録`}</Text>
          <Text>{`相手: ${cr.decision.counterpart ?? "(記録なし)"}`}</Text>
          {/* Phase-107-2:追記 */}
          {cr.decision.option !== null ? (
            <Text>{`選んだ案: ${decidedOptionLabel(cr)}`}</Text>
          ) : null}
          {cr.decision.source_label ? <Text>{`出どころ: ${cr.decision.source_label}`}</Text> : null}
          <Text>{`日時: ${new Date(cr.decision.decided_at).toLocaleString("ja-JP")}`}</Text>
          <Text>{`理由: ${cr.decision.reason}`}</Text>
          {cr.decision.memo ? <Paragraph whiteSpace="pre-wrap">{`メモ: ${cr.decision.memo}`}</Paragraph> : null}
        </YStack>
      ) : null}

      {cr.overlapping.length > 0 ? (
        <YStack gap="$1" aria-label="重なり">
          <Text fontWeight="600">同じ要件を対象にする、進行中の変更要求</Text>
          {cr.overlapping.map((o) => (
            <Link key={o.number} href={changeRequestHref(projectId, o.number)}>
              <Text color="$blue10">{`${o.label}(${o.requirement_ids.join("、")})`}</Text>
            </Link>
          ))}
          {/* Phase-112-4:追記 */}
          <Text color="$color11" fontSize="$2">
            このうち先に反映された CR があると、見出しの下に知らせが出ます。反映の前に、今の文と見比べて確かめます。
          </Text>
        </YStack>
      ) : null}
      {cr.derived_from_number !== null ? (
        <Link href={changeRequestHref(projectId, cr.derived_from_number)}>
          <Text color="$blue10">{`写しの元: CR-${cr.derived_from_number}`}</Text>
        </Link>
      ) : null}
      {cr.derived_numbers.map((n) => (
        <Link key={n} href={changeRequestHref(projectId, n)}>
          <Text color="$blue10">{`写しの先: CR-${n}`}</Text>
        </Link>
      ))}
      {/* Phase-88-3：更新
      <Text>{`合意済みの版 B-${cr.included_baseline_number} に入れました。`}</Text>
      ↓↓ */}
      {cr.included_baseline_number !== null ? (
        <Link href={baselineHref(projectId, cr.included_baseline_number)}>
          <Text color="$blue10">{`合意済みの版 B-${cr.included_baseline_number} に入れました。`}</Text>
        </Link>
      ) : null}
    </YStack>
  );
}
