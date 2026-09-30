// 作成：Phase-11-5｜更新：Phase-11-6,12-5
// 写経レベル: 定型 ── ツールバーとパネルの配線(判断はストアにある)。
"use client";

// Phase-11-6:追記 ── types.DfdElementType, ElementInspector, ValidationPanel
// Phase-12-5:追記 ── DiagramReviewActions
// Phase-12-5：更新 ── labels から DIAGRAM_STATUS_LABELS を削除(状態表示は DiagramReviewActions へ)
import { useEffect } from "react";
import Link from "next/link";
import { Button, H2, Text, XStack, YStack } from "tamagui";
import type { DfdElementType } from "@/features/uml/api/types";
import { DiagramReviewActions } from "@/features/uml/components/DiagramReviewActions";
import { ElementInspector } from "@/features/uml/components/ElementInspector";
import { UmlCanvas } from "@/features/uml/components/UmlCanvas";
import { ValidationPanel } from "@/features/uml/components/ValidationPanel";
import { diagramTitle } from "@/features/uml/labels";
import { useUmlEditorStore } from "@/features/uml/uml-editor-store";

// 自動レイアウトの再実行は、手で動かした座標を置き換える(M6: 明示的な再実行のときだけ上書きする)。
const RELAYOUT_CONFIRM = "現在の配置を自動レイアウトの結果で置き換えます。よろしいですか?";

// Phase-11-6:追記
// DFD は要素の種類ごとに追加ボタンを分ける。component / ER は1種類だけ。
const DFD_ADD_BUTTONS: { type: DfdElementType; label: string }[] = [
  { type: "process", label: "処理を追加" },
  { type: "external_entity", label: "外部実体を追加" },
  { type: "data_store", label: "データストアを追加" },
];

// レビュー画面(SCR-007 の後半)。ツールバーとキャンバスを並べる。
export function UmlDiagramPageContent({
  projectId,
  diagramId,
}: {
  projectId: string;
  diagramId: string;
}) {
  const diagram = useUmlEditorStore((s) => s.diagram);
  const status = useUmlEditorStore((s) => s.status);
  const error = useUmlEditorStore((s) => s.error);
  const dirty = useUmlEditorStore((s) => s.dirty);
  const saving = useUmlEditorStore((s) => s.saving);
  const layingOut = useUmlEditorStore((s) => s.layingOut);
  const conflict = useUmlEditorStore((s) => s.conflict);
  const layoutNotice = useUmlEditorStore((s) => s.layoutNotice);
  // Phase-12-5:追記
  const approving = useUmlEditorStore((s) => s.approving);
  const exporting = useUmlEditorStore((s) => s.exporting);
  // ── ここから Phase-11-5 の作成分 ──
  const load = useUmlEditorStore((s) => s.load);
  const save = useUmlEditorStore((s) => s.save);
  const runLayout = useUmlEditorStore((s) => s.runLayout);
  // Phase-11-6:追記
  const validating = useUmlEditorStore((s) => s.validating);
  const addElement = useUmlEditorStore((s) => s.addElement);
  const validate = useUmlEditorStore((s) => s.validate);

  useEffect(() => {
    void load(projectId, diagramId);
  }, [projectId, diagramId, load]);

  const generating = diagram?.generation_status === "generating";
  // Phase-12-5：更新(承認・出力の最中も他の操作を止める)
  // const busy = saving || layingOut || conflict || generating;
  // ↓↓
  const busy = saving || layingOut || conflict || generating || approving || exporting;

  return (
    <YStack paddingVertical="$4" gap="$3">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2>{diagram ? diagramTitle(diagram) : "設計図"}</H2>
        <Link href={`/projects/${projectId}/uml`}>
          <Text color="$blue10">設計図の一覧に戻る</Text>
        </Link>
      </XStack>

      {status === "loading" ? <Text color="$color11">読み込み中...</Text> : null}
      {status === "error" || error ? (
        <Text role="alert" color="$color9">
          {error}
        </Text>
      ) : null}

      {diagram ? (
        <>
          {/* Phase-12-5：更新(状態表示を承認・出力の操作と一緒に DiagramReviewActions へ移した)
          <Text color="$color11">{`状態: ${DIAGRAM_STATUS_LABELS[diagram.status]}`}</Text>
          ↓↓ */}
          <DiagramReviewActions />
          <XStack gap="$3" alignItems="center" flexWrap="wrap">
            <Button size="$3" disabled={busy || !dirty} onPress={() => void save()}>
              {saving ? "保存中..." : "保存"}
            </Button>
            <Button
              size="$3"
              disabled={busy}
              onPress={() => {
                if (window.confirm(RELAYOUT_CONFIRM)) void runLayout();
              }}
            >
              {layingOut ? "配置中..." : "自動レイアウト"}
            </Button>
            {/* Phase-11-6:追記(検証ボタンと要素の追加ボタン) */}
            <Button size="$3" disabled={busy || validating} onPress={() => void validate()}>
              {validating ? "検証中..." : "検証"}
            </Button>
            {dirty ? <Text color="$color11">未保存の変更があります</Text> : null}
          </XStack>
          <XStack gap="$2" flexWrap="wrap">
            {diagram.notation === "dfd" ? (
              DFD_ADD_BUTTONS.map(({ type, label }) => (
                <Button key={type} size="$2" disabled={busy} onPress={() => addElement(type)}>
                  {label}
                </Button>
              ))
            ) : (
              <Button size="$2" disabled={busy} onPress={() => addElement()}>
                {diagram.notation === "er" ? "テーブルを追加" : "モジュールを追加"}
              </Button>
            )}
            <Text color="$color11" fontSize="$2">
              線はノードの右端から左端へドラッグして追加します。Delete キーで選択中のものを削除します。
            </Text>
          </XStack>

          {generating ? (
            <Text color="$color11">この図は生成中です。生成が終わるまで編集できません。</Text>
          ) : null}
          {conflict ? (
            <XStack gap="$3" alignItems="center">
              <Text role="alert" color="$color9">
                この図は他の画面または再生成で更新されました。再読み込みすると未保存の変更は失われます。
              </Text>
              <Button size="$2" onPress={() => void load(projectId, diagramId)}>
                再読み込み
              </Button>
            </XStack>
          ) : null}
          {layoutNotice ? <Text color="$color9">{layoutNotice}</Text> : null}

          {/* Phase-11-6：更新(キャンバスの下に検証パネル、右に属性パネルを置く)
          <UmlCanvas />
          ↓↓ */}
          <XStack gap="$4" alignItems="flex-start" flexWrap="wrap">
            <YStack flex={1} minWidth={480} gap="$2">
              <UmlCanvas />
              <ValidationPanel />
            </YStack>
            <ElementInspector />
          </XStack>
        </>
      ) : null}
    </YStack>
  );
}
