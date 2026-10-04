// 作成：Phase-17-6｜更新：Phase-17-7,17-8,21-7(画面確認後の修正)
// 写経レベル: コア ── グループの選択を保存してから生成させること、段階の dirty に DFD の未保存の編集も含めること。
"use client";

// Phase-21-7:追記(画面確認後の修正) ── @/features/detailed-design/components/StageSaveBar.StageSaveBar
// Phase-17-7:追記 ── @/features/detailed-design/components/DfdEditorTabs.DfdEditorTabs
// Phase-17-8:追記 ── @/features/detailed-design/components/DataDictionaryTable.DataDictionaryTable
import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  MAX_DFD_GROUPS,
  type DataFlowModel,
  type DesignStageRead,
} from "@/features/detailed-design/api/types";
import { DataDictionaryTable } from "@/features/detailed-design/components/DataDictionaryTable";
import { DfdEditorTabs } from "@/features/detailed-design/components/DfdEditorTabs";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { CELL, HEAD, INPUT, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import {
  countGroupFunctions,
  hasDraft,
  summaryOf,
  toDataFlow,
  toggleDfdGroup,
  updateSummary,
} from "@/features/detailed-design/dataFlowOps";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";

// Phase-17-8：更新
// // 段階2(データフロー)の作業領域の中身。DFD を描く機能グループの選択、AIの下書きの生成、
// // 処理概要表の編集、検証の結果、保存を持つ。
// ↓↓
// 段階2(データフロー)の作業領域の中身。DFD を描く機能グループの選択、AIの下書きの生成、
// 機能グループの DFD(タブ)、データ辞書、処理概要表の編集、検証の結果、保存を持つ。
// DFD とデータ辞書は段階の model の外(uml_diagrams・data_items)に正本があり、それぞれの部品が
// 自分で保存する。この部品の「保存する」は、グループの選択と処理概要表だけを保存する。入力の段階1(承認済みの機能一覧)はストアの段階の
// 一覧から読む。編集中の内容はこのコンポーネントの中だけに持ち、保存して初めてサーバーへ送る
// (保存・生成のたびに呼び出し元が key を変えて作り直す。FunctionListPanel と同じ形)。
export function DataFlowPanel({
  projectId,
  stage,
  onDirtyChange,
}: {
  projectId: string;
  stage: DesignStageRead;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore((s) => s.requestingGeneration);
  const stage1Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 1)?.model ?? null,
  );
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);

  const functionList = toFunctionList(stage1Model);
  const saved = toDataFlow(stage.model);
  const [draft, setDraft] = useState<DataFlowModel>(saved);
  const [confirming, setConfirming] = useState(false);
  // Phase-17-7:追記
  // DFD のエディタに保存していない編集があるか(段階の承認は、保存した DFD を前提にするため)
  const [dfdDirty, setDfdDirty] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  // Phase-17-7：更新
  // useEffect(() => {
  //   onDirtyChange(dirty);
  // }, [dirty, onDirtyChange]);
  // ↓↓
  useEffect(() => {
    onDirtyChange(dirty || dfdDirty);
  }, [dirty, dfdDirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const regenerating = hasDraft(saved);

  const startGeneration = () => {
    setConfirming(false);
    void generate(projectId, stage.stage);
  };

  return (
    <YStack gap="$4">
      {/* Phase-21-7:追記(画面確認後の修正) */}
      <StageSaveBar
        dirty={dirty}
        saving={saving}
        disabled={generating || !stage.is_open}
        onSave={() => void save(projectId, stage.stage, draft)}
      />

      {/* ── ここから Phase-17-6 の作成分 ── */}
      <YStack gap="$2">
        <Text fontWeight="700">DFD を描く機能グループ</Text>
        <Paragraph color="$color11" fontSize="$2">
          データの流れが込み入ったグループだけを選びます({MAX_DFD_GROUPS}
          つまで)。選ばなかったグループの処理は、処理概要表の行で済ませます。選んだら保存してから下書きを生成してください。
        </Paragraph>
        <XStack gap="$3" flexWrap="wrap">
          {functionList.groups.map((group) => {
            const checked = draft.dfd_groups.includes(group);
            const full = !checked && draft.dfd_groups.length >= MAX_DFD_GROUPS;
            return (
              <label key={group} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={full || generating}
                  onChange={(e) =>
                    setDraft((m) => toggleDfdGroup(m, group, e.target.checked))
                  }
                />
                <span style={{ color: "var(--color)" }}>
                  {group}({countGroupFunctions(functionList, group)}件)
                </span>
              </label>
            );
          })}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={!stage.is_open || generating || requestingGeneration || dirty}
            onPress={() => (regenerating ? setConfirming(true) : startGeneration())}
          >
            {generating
              ? "生成中"
              : regenerating
                ? "下書きを作り直す"
                : "下書きを生成する"}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "保存してから生成してください(生成は保存したグループの選択を使います)。"
              : "機能一覧と要件定義書から、AI が処理概要表と、選んだグループの DFD を下書きします。"}
          </Text>
        </XStack>
        {generating && timedOut ? (
          <Text role="status" color="$color11">
            生成に時間がかかっています。しばらくしてから画面を読み込み直してください。
          </Text>
        ) : null}
        {stage.generation_status === "failed" && stage.generation_error ? (
          <Text role="alert" color="$red10">
            {stage.generation_error}
          </Text>
        ) : null}
      </YStack>

      <ConfirmDialog
        open={confirming}
        title="下書きを作り直しますか?"
        description={
          <>
            AI が処理概要表と、選んだグループの DFD を作り直します。DFD を描くグループの選択は
            そのまま残ります。DFD の手直しは失われ、DFD の承認もやり直しになります。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認もやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={startGeneration}
        onCancel={() => setConfirming(false)}
      />

      {/* Phase-17-7:追記 */}
      <DfdEditorTabs
        projectId={projectId}
        groups={saved.dfd_groups}
        generating={generating}
        onDirtyChange={setDfdDirty}
      />

      {/* Phase-17-8:追記 */}
      <DataDictionaryTable projectId={projectId} disabled={generating} />

      {functionList.functions.length > 0 ? (
        <YStack gap="$2">
          <Text fontWeight="700">処理概要表</Text>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={HEAD}>処理ID</th>
                  <th style={HEAD}>名称</th>
                  <th style={HEAD}>機能グループ</th>
                  <th style={HEAD}>入力</th>
                  <th style={HEAD}>処理内容</th>
                  <th style={HEAD}>出力</th>
                </tr>
              </thead>
              <tbody>
                {functionList.functions.map((fn) => {
                  const row = summaryOf(draft, fn.id);
                  return (
                    <tr key={fn.id}>
                      <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{fn.id}</td>
                      <td style={{ ...CELL, minWidth: 140 }}>{fn.name}</td>
                      <td style={{ ...CELL, whiteSpace: "nowrap" }}>{fn.group}</td>
                      <td style={{ ...CELL, minWidth: 140 }}>
                        <input
                          style={INPUT}
                          aria-label={`${fn.id} の入力`}
                          value={row.input}
                          placeholder={generating ? "生成中" : undefined}
                          disabled={generating}
                          onChange={(e) =>
                            setDraft((m) => updateSummary(m, fn.id, { input: e.target.value }))
                          }
                        />
                      </td>
                      <td style={{ ...CELL, minWidth: 260 }}>
                        <textarea
                          style={{ ...INPUT, minHeight: 48, resize: "vertical" }}
                          aria-label={`${fn.id} の処理内容`}
                          value={row.process}
                          placeholder={generating ? "生成中" : undefined}
                          disabled={generating}
                          onChange={(e) =>
                            setDraft((m) => updateSummary(m, fn.id, { process: e.target.value }))
                          }
                        />
                      </td>
                      <td style={{ ...CELL, minWidth: 140 }}>
                        <input
                          style={INPUT}
                          aria-label={`${fn.id} の出力`}
                          value={row.output}
                          placeholder={generating ? "生成中" : undefined}
                          disabled={generating}
                          onChange={(e) =>
                            setDraft((m) => updateSummary(m, fn.id, { output: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </YStack>
      ) : null}

      {/* Phase-21-7：更新(画面確認後の修正。保存の操作を StageSaveBar にして、上部にも同じものを置いた)
         <XStack gap="$3" alignItems="center" flexWrap="wrap">
           <StyledButton
             disabled={!dirty || saving || generating || !stage.is_open}
             onPress={() => void save(projectId, stage.stage, draft)}
           >
             {saving ? "保存しています..." : "保存する"}
           </StyledButton>
           {dirty ? (
             <Text color="$color11" fontSize="$2">
               保存していない編集があります。
             </Text>
           ) : null}
         </XStack>
         ↓↓ */}
      <StageSaveBar
        dirty={dirty}
        saving={saving}
        disabled={generating || !stage.is_open}
        onSave={() => void save(projectId, stage.stage, draft)}
      />

      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}
