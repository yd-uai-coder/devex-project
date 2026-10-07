// 作成：Phase-29-4
"use client";

import { useEffect, useState } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import { getProcedureSequence } from "@/features/detailed-design/api/designStagesApi";
import type { SequenceRead } from "@/features/detailed-design/api/types";

// devex-api が書いたシーケンス図の SVG をそのまま埋め込む。SVG の中の文字は devex-api
// (app/detailed_design/sequence_svg.py)でエスケープ済みなので、ここではエスケープしない。
// 図が広いときは横にスクロールする。
export function SequenceSvg({ svg, label }: { svg: string; label: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ overflowX: "auto", border: "1px solid var(--color6)", borderRadius: 4 }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// 取得の結果。key は取得したときの「処理ID:版」で、今の key と違えば読み込み中とみなす
type State =
  | { key: string; status: "success"; sequence: SequenceRead }
  | { key: string; status: "error"; message: string };

// 段階5の処理1つのシーケンス図(手順の表の下に置く)。図は保存した手順から devex-api が導く読み取り専用の
// 見え方で、直すのは表。保存(段階の版が変わる)のたびに取り直す。保存していない編集があれば、その旨を出す。
// 図にするときの指摘(戻りを呼び出しとして書いている、など)は図の下に並べる(段階5の検証の警告と同じ)。
export function ProcedureSequenceView({
  projectId,
  functionId,
  version,
  dirty,
}: {
  projectId: string;
  functionId: string;
  version: number | null; // 段階5の版(保存のたびに変わる)
  dirty: boolean;
}) {
  const key = `${functionId}:${version}`;
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    let alive = true;
    getProcedureSequence(projectId, functionId)
      .then((sequence) => alive && setState({ key, status: "success", sequence }))
      .catch(
        (err: unknown) =>
          alive &&
          setState({
            key,
            status: "error",
            message: err instanceof Error ? err.message : "シーケンス図の取得に失敗しました",
          }),
      );
    return () => {
      alive = false;
    };
  }, [projectId, functionId, key]);

  return (
    <YStack gap="$2">
      <Text fontWeight="700">シーケンス図</Text>
      <Paragraph color="$color11" fontSize="$2">
        保存した手順から導いた図です。直すときは上の表を直します(矢印の番号は表の No)。
        {dirty ? "保存していない編集は、保存すると図に反映されます。" : ""}
      </Paragraph>
      {state === null || state.key !== key ? (
        <Text color="$color11">シーケンス図を読み込み中...</Text>
      ) : state.status === "error" ? (
        <Text role="alert" color="$red10">
          {state.message}
        </Text>
      ) : (
        <>
          <SequenceSvg svg={state.sequence.svg} label={`${functionId} のシーケンス図`} />
          {state.sequence.issues.length > 0 ? (
            <YStack gap="$1" aria-label="図にするときの指摘">
              {state.sequence.issues.map((issue, index) => (
                <Text key={index} color="$orange11" fontSize="$2">
                  {issue.step_id}: {issue.message}
                </Text>
              ))}
            </YStack>
          ) : null}
        </>
      )}
    </YStack>
  );
}
