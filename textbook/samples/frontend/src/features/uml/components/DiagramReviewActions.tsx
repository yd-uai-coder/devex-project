// 作成：Phase-12-5
// 写経レベル: 定型 ── 状態ごとのボタンの出し分け。どの状態で承認・出力できるかは BE の status.py を写しただけ(注意書き2つの文言は D6・M7 の決定)。
"use client";

import { Button, Text, XStack, YStack } from "tamagui";
import type { DiagramStatus } from "@/features/uml/api/types";
import { DIAGRAM_STATUS_LABELS } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 承認できる状態・出力できる状態(devex-api app/uml/domain/status.py の can_approve / can_export)
const APPROVABLE: DiagramStatus[] = ["draft", "reviewing"];
const EXPORTABLE: DiagramStatus[] = ["approved", "exported"];

// 承認済みの図を保存すると承認をやり直す(M7)ことを、編集する前に知らせる
const REAPPROVAL_NOTICE = "承認済みの図を保存すると、レビュー中に戻ります(承認し直してください)。";
// ダウンロードしたファイルは最終成果物で、Devex に読み戻さない(D6)
const EXPORT_NOTICE =
  "ダウンロードしたファイルを直接編集しても、Devex には反映されません。修正はこの画面で行い、承認し直してから出力してください。";

// レビュー画面の状態表示と、承認(M7)・出力(M8)の操作。
export function DiagramReviewActions() {
  const diagram = useUmlEditorStore((s) => s.diagram);
  const dirty = useUmlEditorStore((s) => s.dirty);
  const saving = useUmlEditorStore((s) => s.saving);
  const layingOut = useUmlEditorStore((s) => s.layingOut);
  const conflict = useUmlEditorStore((s) => s.conflict);
  const approving = useUmlEditorStore((s) => s.approving);
  const exporting = useUmlEditorStore((s) => s.exporting);
  const approve = useUmlEditorStore((s) => s.approve);
  const exportDiagram = useUmlEditorStore((s) => s.exportDiagram);

  if (!diagram) return null;

  const generating = diagram.generation_status === "generating";
  const busy = saving || layingOut || conflict || approving || exporting || generating;
  const approvable = APPROVABLE.includes(diagram.status);
  // 承認済みでも、未保存の変更があれば出力しない(出力されるのは保存済み=承認した版のため)
  const exportable = EXPORTABLE.includes(diagram.status) && !dirty;

  return (
    <YStack gap="$2">
      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Text color="$color11">{`状態: ${DIAGRAM_STATUS_LABELS[diagram.status]}`}</Text>
        {approvable ? (
          <Button size="$3" theme="blue" disabled={busy} onPress={() => void approve()}>
            {approving ? "承認中..." : dirty ? "保存して承認" : "承認"}
          </Button>
        ) : null}
        {EXPORTABLE.includes(diagram.status) ? (
          <>
            <Button
              size="$3"
              disabled={busy || !exportable}
              onPress={() => void exportDiagram("drawio")}
            >
              draw.io で出力(.drawio)
            </Button>
            <Button
              size="$3"
              disabled={busy || !exportable}
              onPress={() => void exportDiagram("svg")}
            >
              SVG で出力(.svg)
            </Button>
          </>
        ) : null}
      </XStack>
      {EXPORTABLE.includes(diagram.status) ? (
        <>
          <Text color="$color11" fontSize="$2">
            {REAPPROVAL_NOTICE}
          </Text>
          <Text color="$color11" fontSize="$2">
            {EXPORT_NOTICE}
          </Text>
        </>
      ) : null}
    </YStack>
  );
}
