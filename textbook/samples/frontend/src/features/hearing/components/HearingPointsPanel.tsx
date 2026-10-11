// 作成：Phase-34-3｜更新：Phase-35(完了後の調整)
// Phase-35(完了後の調整):追記 ── Button, XStack(tamagui)
import { Button, Text, XStack, YStack } from "tamagui";
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

// Phase-35(完了後の調整)：更新(未決の必須の名前を見出しに並べ、状態の欄で必須と任意を書き分ける。onSkip を受ける)
// export function openRequiredCount(view: HearingPointsView): number {
//   return view.points.filter((p) => p.required && p.status === "open").length;
// }
//
// // チャット画面の観点の表。完了の判定はサーバーが観点の表から行う(必須がすべて未決以外)ので、
// // ここでは表と、未決の必須の件数を見せるだけ。表は <details> で畳める(狭い画面ではチャットの
// // 上に置くため)。defaultOpen は置き場所に合わせて呼び出し側が決める。
// export function HearingPointsPanel({ view, defaultOpen }: { view: HearingPointsView; defaultOpen: boolean }) {
//   const openCount = openRequiredCount(view);
// ↓↓
export function openRequiredCount(view: HearingPointsView): number {
  return openRequiredLabels(view).length;
}

// 未決の必須の観点の名前(見出しに並べ、どれが必須かを一目で分かるようにする)
export function openRequiredLabels(view: HearingPointsView): string[] {
  return view.points.filter((p) => p.required && p.status === "open").map((p) => p.label);
}

// 状態の欄の文字。未決は必須か任意かを書き分ける(未決の行が多いと、どれが必須か分からないため)
function statusText(required: boolean, status: HearingPointStatus): string {
  if (status !== "open") return STATUS_LABEL[status];
  return required ? "未決(必須)" : "未決(任意)";
}

// チャット画面の観点の表。完了の判定はサーバーが観点の表から行う(必須がすべて未決以外)ので、
// ここでは表と、未決の必須の件数を見せるだけ。表は <details> で畳める(狭い画面ではチャットの
// 上に置くため)。defaultOpen は置き場所に合わせて呼び出し側が決める。
// onSkip があれば、未決の必須の行に「対象外にする」を出す(判定の AI が決められない観点で、
// ヒアリングが先へ進めなくなるのを避ける。サーバーは「後で決める」として記録する)。
export function HearingPointsPanel({
  view,
  defaultOpen,
  onSkip,
  skippingKey,
}: {
  view: HearingPointsView;
  defaultOpen: boolean;
  onSkip?: (pointKey: string) => void;
  // 対象外にしている最中の観点(ボタンを無効にする)
  skippingKey?: string | null;
}) {
  const openLabels = openRequiredLabels(view);
  const openCount = openLabels.length;
  const scaleText = view.scale
    ? SCALE_LABEL[view.scale]
    : `未決(${SCALE_LABEL.personal}の列で必須を数えています)`;
  // Phase-35(完了後の調整)：更新
  // const heading = view.is_sufficient ? "観点の表 ── 必須はすべて決まりました" : `観点の表 ── 未決の必須 ${openCount} 件`;
  // ↓↓
  const heading = view.is_sufficient
    ? "観点の表 ── 必須はすべて決まりました"
    : `観点の表 ── 未決の必須 ${openCount} 件${openCount > 0 ? `: ${openLabels.join("、")}` : ""}`;

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
                    {/* Phase-35(完了後の調整)：更新
                    <td style={{ ...CELL, whiteSpace: "nowrap", fontWeight: 600, color: STATUS_COLOR[p.status] }}>
                      {STATUS_LABEL[p.status]}
                    </td>
                    ↓↓ */}
                    {/* 任意の未決は灰色・太字なしにし、必須の未決(赤)と見分ける */}
                    <td
                      style={{
                        ...CELL,
                        whiteSpace: "nowrap",
                        fontWeight: p.status === "open" && !p.required ? 400 : 600,
                        color: p.status === "open" && !p.required ? "var(--color10)" : STATUS_COLOR[p.status],
                      }}
                    >
                      <XStack gap="$2" alignItems="center" flexWrap="wrap">
                        <Text color="inherit" fontWeight="inherit" fontSize="inherit">
                          {statusText(p.required, p.status)}
                        </Text>
                        {onSkip && p.required && p.status === "open" && !view.legacy ? (
                          <Button
                            size="$1"
                            aria-label={`${p.label}を対象外にする`}
                            disabled={Boolean(skippingKey)}
                            onPress={() => onSkip(p.key)}
                          >
                            対象外にする
                          </Button>
                        ) : null}
                      </XStack>
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
