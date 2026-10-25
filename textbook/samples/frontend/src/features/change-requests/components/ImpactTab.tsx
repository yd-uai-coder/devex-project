// 作成：Phase-87-3｜更新：Phase-98-2,107-1
"use client";

// Phase-98-2:追記 ── @/features/change-requests/api/types.ChangeRequestOriginRead, @/features/change-requests/changeRequestOps.originLabel
// Phase-107-1:追記 ── @/features/change-requests/api/types.ScaleComparisonRead, @/features/change-requests/changeRequestOps.scaleCell, @/features/change-requests/changeRequestOps.scaleComparisonBasis
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Paragraph, Text, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import type {
  ChangeRequestOriginRead,
  ChangeRequestRead,
  ComparedItemRead,
  PredictedItemRead,
  ScaleComparisonRead,
} from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import {
  canReflectDocuments,
  comparisonGroups,
  groupByStage,
  isApplied,
  originLabel,
  scaleCell,
  scaleComparisonBasis,
  stageLabel,
} from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { failureHeading } from "@/lib/generation-failure";

// 詳細の「影響」タブ。合意の前は基準の版から求めた予測、判断の後は保存した予測を段階ごとに出す。
// 合意・反映済みの CR は、文書(要件定義書から)への反映のボタンを出す(段階への反映は詳細設計画面の
// Phase-98-2：更新
// // 「変更の影響」で CR を選ぶ)。反映の後は、予測と実際の印の比較を3つに分けて出す。
// ↓↓
// Phase-107-1：更新
// // 「変更の影響」で CR を選ぶ)。反映の後は、予測と実際の印の比較を3つに分けて出す。新しい要件を足す
// ↓↓
// 「変更の影響」で CR を選ぶ)。反映の後は、規模の予測と実際の数と、予測と実際の印の比較を3つに分けて出す。新しい要件を足す
// CR は、予測に使った起点と、要素ごとに届いた起点も出す。
export function ImpactTab({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const impact = useChangeRequestsStore((s) => s.views.impact);
  const comparison = useChangeRequestsStore((s) => s.views.comparison);
  const viewErrors = useChangeRequestsStore((s) => s.viewErrors);
  const fetchView = useChangeRequestsStore((s) => s.fetchView);
  const reflecting = useChangeRequestsStore((s) => s.reflecting);
  const reflectError = useChangeRequestsStore((s) => s.reflectError);
  const reflectFailure = useChangeRequestsStore((s) => s.reflectFailure);
  const reflectDocuments = useChangeRequestsStore((s) => s.reflectDocuments);
  const [confirming, setConfirming] = useState(false);
  const applied = isApplied(cr.status);

  useEffect(() => {
    if (impact === null) void fetchView(projectId, cr.number, "impact");
  }, [impact, projectId, cr.number, fetchView]);
  useEffect(() => {
    if (applied && comparison === null) void fetchView(projectId, cr.number, "comparison");
  }, [applied, comparison, projectId, cr.number, fetchView]);

  return (
    <YStack gap="$4">
      {canReflectDocuments(cr.status) ? (
        <YStack gap="$2" aria-label="反映">
          <Text fontWeight="600">反映</Text>
          <Paragraph color="$color11">
            {cr.status === "agreed"
              ? "合意した内容を指示に入れて、要件定義書から文書を作り直します。作り直しが終わると反映済みになります。"
              : "反映済みです。作り直しはやり直せます(そのたびに記録に1行残ります)。段階は、詳細設計画面の「変更の影響」でこの CR を選んで作り直します。"}
          </Paragraph>
          <Button size="$3" theme="green" alignSelf="flex-start" disabled={reflecting} onPress={() => setConfirming(true)}>
            {reflecting ? "反映中(文書を作り直しています)..." : "文書へ反映する(要件定義書から再生成)"}
          </Button>
          {reflectError ? (
            <Text role="alert" color="$red10">
              {reflectError}
            </Text>
          ) : null}
          {reflectFailure ? (
            <Text role="alert" color="$red10">
              {`${failureHeading(reflectFailure)}: ${reflectFailure.message}`}
            </Text>
          ) : null}
          {cr.status === "applied" ? (
            <Link href={`/projects/${projectId}/detailed-design`}>
              <Text color="$blue10">詳細設計画面で段階へ反映する →</Text>
            </Link>
          ) : null}
        </YStack>
      ) : null}

      {applied ? (
        <YStack gap="$2" aria-label="予測と実際の比較">
          <Text fontWeight="600">予測と実際の比較</Text>
          {viewErrors.comparison ? (
            <Text role="alert" color="$red10">
              {viewErrors.comparison}
            </Text>
          ) : null}
          {comparison === null && !viewErrors.comparison ? <Text color="$color11">読み込み中...</Text> : null}
          {/* Phase-107-1:追記 */}
          {comparison && comparison.scale.length > 0 ? <ScaleComparison rows={comparison.scale} /> : null}
          {comparison
            ? comparisonGroups(comparison.items).map((group) => (
                <ComparisonGroup
                  key={group.status}
                  title={`${group.items[0]?.status_label ?? STATUS_TITLE[group.status]}(${comparison.counts[group.status] ?? 0})`}
                  items={group.items}
                />
              ))
            : null}
        </YStack>
      ) : null}

      <YStack gap="$2" aria-label="影響の予測">
        <Text fontWeight="600">影響の予測</Text>
        {viewErrors.impact ? (
          <Text role="alert" color="$red10">
            {viewErrors.impact}
          </Text>
        ) : null}
        {impact === null && !viewErrors.impact ? <Text color="$color11">読み込み中...</Text> : null}
        {impact ? (
          <>
            <Text color="$color11">
              {impact.saved
                ? `判断の時点で保存した予測です(基準: ${impact.baseline_label})。`
                : `基準の合意済みの版(${impact.baseline_label})から求めた予測です(判断すると保存します)。`}
            </Text>
            {/* Phase-98-2:追記 */}
            {impact.origins.length > 0 ? (
              <Text>{`新しい要件の予測の起点: ${impact.origins.map((o) => o.label).join("、")}`}</Text>
            ) : null}
            {impact.unpredicted_new_requirement ? (
              // Phase-98-2：更新
              // <Text color="$color11">新しい要件を足す分は、起点の要素が無いので予測に入っていません。</Text>
              // ↓↓
              <Text color="$color11">
                新しい要件を足す分は、予測の起点を選んでいないので予測に入っていません(「内容」タブで起点を選べます)。
              </Text>
            ) : null}
            {impact.excluded.length > 0 ? (
              <Text color="$color11">
                {`基準の版に入っていない段階(予測に出ません): ${impact.excluded.map((e) => e.key).join("、")}`}
              </Text>
            ) : null}
            {impact.items.length === 0 ? <Text>予測に出た要素はありません。</Text> : null}
            {groupByStage(impact.items).map((group) => (
              // Phase-98-2：更新
              // <PredictionGroup key={group.stage} stage={group.stage} items={group.items} />
              // ↓↓
              <PredictionGroup key={group.stage} stage={group.stage} items={group.items} origins={impact.origins} />
            ))}
          </>
        ) : null}
      </YStack>

      <ConfirmDialog
        open={confirming}
        title="文書へ反映する"
        description="この CR を指示に入れて、要件定義書と外部設計書を作り直します。生成には数分かかります。"
        confirmLabel="反映する"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void reflectDocuments(projectId, cr.number);
        }}
      />
    </YStack>
  );
}

// Phase-107-1:追記
// 規模の予測と実際(数えられなければ「数えられない」)。画面・API は印が付かないので、文書の側の確認で確かめた数
function ScaleComparison({ rows }: { rows: ScaleComparisonRead[] }) {
  return (
    <table style={TABLE} aria-label="規模の予測と実際">
      <thead>
        <tr>
          <th style={HEAD}>種類</th>
          <th style={HEAD}>予測</th>
          <th style={HEAD}>実際</th>
          <th style={HEAD}>実際の数え方</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.kind}>
            <td style={CELL}>{row.label}</td>
            <td style={CELL}>{scaleCell(row.predicted)}</td>
            <td style={CELL}>{scaleCell(row.actual)}</td>
            <td style={CELL}>{scaleComparisonBasis(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STATUS_TITLE = { matched: "一致", predicted_only: "予測だけ", actual_only: "実際だけ(予測の外)" } as const;

// Phase-98-2：更新
// function PredictionGroup({ stage, items }: { stage: number; items: PredictedItemRead[] }) {
// ↓↓
function PredictionGroup({
  stage,
  items,
  origins,
}: {
  stage: number;
  items: PredictedItemRead[];
  origins: ChangeRequestOriginRead[];
}) {
  // 起点を使った予測のときだけ「届いた起点」の列を出す
  const withOrigins = origins.length > 0;
  return (
    <YStack gap="$1">
      <Text fontSize="$3">{`${stageLabel(stage)}(${items.length})`}</Text>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={HEAD}>要素</th>
            <th style={HEAD}>理由</th>
            <th style={HEAD}>届いた要件</th>
            {/* Phase-98-2:追記 */}
            {withOrigins ? <th style={HEAD}>届いた起点</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <td style={CELL}>{item.label}</td>
              <td style={CELL}>{item.reason}</td>
              <td style={{ ...CELL, ...MONO }}>{item.requirement_ids.join(", ")}</td>
              {/* Phase-98-2:追記 */}
              {withOrigins ? (
                <td style={CELL}>{item.origin_keys.map((key) => originLabel(origins, key)).join("、")}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </YStack>
  );
}

function ComparisonGroup({ title, items }: { title: string; items: ComparedItemRead[] }) {
  return (
    <YStack gap="$1">
      <Text fontSize="$3">{title}</Text>
      {items.length === 0 ? (
        <Text color="$color11">なし</Text>
      ) : (
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={HEAD}>段階</th>
              <th style={HEAD}>要素</th>
              <th style={HEAD}>予測の理由</th>
              <th style={HEAD}>実際の理由</th>
              <th style={HEAD}>確認</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <td style={{ ...CELL, whiteSpace: "nowrap" }}>{stageLabel(item.stage)}</td>
                <td style={CELL}>{item.label}</td>
                <td style={CELL}>
                  {item.predicted_reason}
                  {item.predicted_only_reason_label ? `(${item.predicted_only_reason_label})` : ""}
                </td>
                <td style={CELL}>{item.actual_reason}</td>
                <td style={CELL}>{item.reviewed === null ? "─" : item.reviewed ? "確認済み" : "未確認"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </YStack>
  );
}
