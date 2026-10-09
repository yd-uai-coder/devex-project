// 作成：Phase-34-3
import { Text, YStack } from "tamagui";
import { CELL, HEAD, TABLE } from "@/features/detailed-design/components/tableStyles";
import type {
  HearingPointStatus,
  HearingPointsView,
  HearingScale,
} from "@/features/hearing/api/hearingApi";

const STATUS_LABEL: Record<HearingPointStatus, string> = {
  decided: "ユーザーが決定",
  adopted: "AI の提案を採用",
  open: "未決",
  not_applicable: "対象外",
};
const STATUS_COLOR: Record<HearingPointStatus, string> = {
  decided: "var(--green10)",
  adopted: "var(--blue10)",
  open: "var(--red10)",
  not_applicable: "var(--color10)",
};
const SCALE_LABEL: Record<HearingScale, string> = {
  personal: "個人・小規模",
  internal: "社内",
  public: "公開サービス",
};

export function openRequiredCount(view: HearingPointsView): number {
  return view.points.filter((p) => p.required && p.status === "open").length;
}

// チャット画面の観点の表。完了の判定はサーバーが観点の表から行う(必須がすべて未決以外)ので、
// ここでは表と、未決の必須の件数を見せるだけ。表は <details> で畳める(狭い画面ではチャットの
// 上に置くため)。defaultOpen は置き場所に合わせて呼び出し側が決める。
export function HearingPointsPanel({ view, defaultOpen }: { view: HearingPointsView; defaultOpen: boolean }) {
  const openCount = openRequiredCount(view);
  const scaleText = view.scale
    ? SCALE_LABEL[view.scale]
    : `未決(${SCALE_LABEL.personal}の列で必須を数えています)`;
  const heading = view.is_sufficient ? "観点の表 ── 必須はすべて決まりました" : `観点の表 ── 未決の必須 ${openCount} 件`;

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$4"
      backgroundColor="$color2"
    >
      <details open={defaultOpen}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>{heading}</summary>
        <YStack gap="$2" marginTop="$2">
          <Text fontSize="$2">規模: {scaleText}</Text>
          {view.legacy ? (
            <Text role="note" fontSize="$2" color="$color11">
              このプロジェクトは以前の判定(5条件)で進んでいます。次の発言から観点の表で判定します。
            </Text>
          ) : null}
          {view.stale ? (
            <Text role="note" fontSize="$2" color="$color11">
              直近の発言は表に反映できていません。次の発言で判定し直します。
            </Text>
          ) : null}
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE} aria-label="観点の表">
              <thead>
                <tr>
                  {["観点", "必須", "状態", "決めたこと", "根拠"].map((h) => (
                    <th key={h} style={HEAD}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.points.map((p) => (
                  <tr key={p.key}>
                    <td style={CELL}>{p.label}</td>
                    <td style={CELL}>{p.required ? "○" : ""}</td>
                    <td style={{ ...CELL, whiteSpace: "nowrap", fontWeight: 600, color: STATUS_COLOR[p.status] }}>
                      {STATUS_LABEL[p.status]}
                    </td>
                    {/* 未決の観点は、場面で聞く問いの例を薄く出す(何を聞かれるかが分かるように) */}
                    <td style={p.summary ? CELL : { ...CELL, color: "var(--color10)" }}>
                      {p.summary || p.question}
                    </td>
                    <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                      {p.evidence.map((e) => e.label).join("・")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </YStack>
      </details>
    </YStack>
  );
}
