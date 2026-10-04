// 作成：Phase-16-6｜更新：Phase-17-6
// 写経レベル: コア ── 編集中の内容を手元に持ち、保存して初めて送ること。作り直す前の確認と、生成中の操作の止め方。
"use client";

// Phase-17-6:追記 ── @/features/detailed-design/components/StageIssueList.StageIssueList, @/features/detailed-design/components/tableStyles(CELL, HEAD, INPUT, MONO, OPTION, TABLE)
// Phase-17-6：削除 ── react.CSSProperties(表の見た目を tableStyles.ts へ移した)
import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import { StyledInput } from "@/components/ui/primitives/StyledInput";
import type {
  DesignStageRead,
  FunctionKind,
  FunctionListModel,
} from "@/features/detailed-design/api/types";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import {
  CELL,
  HEAD,
  INPUT,
  MONO,
  OPTION,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  addGroup,
  addRow,
  FUNCTION_KINDS,
  isGroupUsed,
  removeGroup,
  removeRow,
  renameGroup,
  screensToText,
  textToScreens,
  toFunctionList,
  updateRow,
} from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
// Phase-17-6：削除(段階2の表と共有するため components/tableStyles.ts へ移した)
// // 表は列が多く横に長いので、Tamagui の部品ではなく素の table と入力欄で詰めて並べる
// // (Phase 14 のデモ demo/DetailedDesignDemoPageContent.tsx と同じ書き方)。
// const CELL: CSSProperties = {
//   padding: "4px 6px",
//   borderBottom: "1px solid var(--borderColor)",
//   textAlign: "left",
//   verticalAlign: "top",
// };
// const HEAD: CSSProperties = { ...CELL, background: "var(--color3)", whiteSpace: "nowrap" };
// const TABLE: CSSProperties = {
//   borderCollapse: "collapse",
//   fontSize: 13,
//   color: "var(--color)",
//   width: "100%",
// };
// // 背景はテーマの色にする。transparent だと、セレクトの選択肢(ブラウザが描くポップアップ)が
// // 既定の白になり、ダークモードでは文字と同じ色になって読めない(Phase 16 の修正)。
// const INPUT: CSSProperties = {
//   width: "100%",
//   boxSizing: "border-box",
//   padding: "2px 4px",
//   font: "inherit",
//   color: "var(--color)",
//   background: "var(--background)",
//   border: "1px solid var(--borderColor)",
//   borderRadius: 4,
// };
// const OPTION: CSSProperties = { background: "var(--background)", color: "var(--color)" };
// const MONO: CSSProperties = {
//   fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
//   fontSize: 12,
// };

// 段階1(機能一覧)の作業領域の中身。AIの下書きの生成、機能グループと機能一覧の表の編集、
// 検証の結果、保存を持つ。編集中の内容はこのコンポーネントの中だけに持ち、保存して初めて
// サーバーへ送る(保存・生成のたびに呼び出し元が key を変えて作り直す)。
export function FunctionListPanel({
  projectId,
  stage,
  onDirtyChange,
}: {
  projectId: string;
  stage: DesignStageRead;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore(
    (s) => s.requestingGeneration,
  );
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);

  const saved = toFunctionList(stage.model);
  const [draft, setDraft] = useState<FunctionListModel>(saved);
  const [newGroup, setNewGroup] = useState("");
  const [confirming, setConfirming] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const hasContent = stage.model !== null;

  const startGeneration = () => {
    setConfirming(false);
    void generate(projectId, stage.stage);
  };

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={!stage.is_open || generating || requestingGeneration}
            onPress={() => (hasContent ? setConfirming(true) : startGeneration())}
          >
            {generating
              ? "下書きを生成しています..."
              : hasContent
                ? "下書きを作り直す"
                : "下書きを生成する"}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            外部設計書の画面一覧と API 一覧から、AI が処理を下書きします。
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
            AI が機能一覧を作り直します。処理ID と確定した機能グループは、トリガーが同じ行に
            引き継ぎます。
            {dirty ? "保存していない編集は失われます。" : ""}
            {stage.state === "approved" || stage.state === "outdated"
              ? "承認はやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={startGeneration}
        onCancel={() => setConfirming(false)}
      />

      {hasContent || draft.functions.length > 0 ? (
        <>
          <YStack gap="$2">
            <Text fontWeight="700">機能グループ</Text>
            <Paragraph color="$color11" fontSize="$2">
              初期値は API のパスのリソース名です。名前を変えると、そのグループの処理も付け替わります。
            </Paragraph>
            <XStack gap="$2" flexWrap="wrap">
              {draft.groups.map((group) => (
                <GroupItem
                  key={group}
                  group={group}
                  used={isGroupUsed(draft, group)}
                  onRename={(to) => setDraft((m) => renameGroup(m, group, to))}
                  onRemove={() => setDraft((m) => removeGroup(m, group))}
                />
              ))}
            </XStack>
            <XStack gap="$2" alignItems="center">
              <StyledInput
                size="$3"
                width={200}
                aria-label="新しい機能グループ"
                placeholder="新しい機能グループ"
                value={newGroup}
                onChangeText={setNewGroup}
              />
              <StyledButton
                size="$3"
                disabled={!newGroup.trim()}
                onPress={() => {
                  setDraft((m) => addGroup(m, newGroup));
                  setNewGroup("");
                }}
              >
                グループを追加
              </StyledButton>
            </XStack>
          </YStack>

          <div style={{ overflowX: "auto" }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={HEAD}>処理ID</th>
                  <th style={HEAD}>名称</th>
                  <th style={HEAD}>種別</th>
                  <th style={HEAD}>トリガー</th>
                  <th style={HEAD}>関連画面</th>
                  <th style={HEAD}>機能グループ</th>
                  <th style={HEAD}>概要</th>
                  <th style={HEAD} />
                </tr>
              </thead>
              <tbody>
                {draft.functions.map((row) => (
                  <tr key={row.id}>
                    <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{row.id}</td>
                    <td style={{ ...CELL, minWidth: 160 }}>
                      <input
                        style={INPUT}
                        aria-label={`${row.id} の名称`}
                        value={row.name}
                        onChange={(e) =>
                          setDraft((m) => updateRow(m, row.id, { name: e.target.value }))
                        }
                      />
                    </td>
                    <td style={CELL}>
                      <select
                        style={INPUT}
                        aria-label={`${row.id} の種別`}
                        value={row.kind}
                        onChange={(e) =>
                          setDraft((m) =>
                            updateRow(m, row.id, { kind: e.target.value as FunctionKind }),
                          )
                        }
                      >
                        {FUNCTION_KINDS.map((kind) => (
                          <option key={kind} value={kind} style={OPTION}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...CELL, minWidth: 220 }}>
                      <input
                        style={{ ...INPUT, ...MONO }}
                        aria-label={`${row.id} のトリガー`}
                        value={row.trigger}
                        onChange={(e) =>
                          setDraft((m) => updateRow(m, row.id, { trigger: e.target.value }))
                        }
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 100 }}>
                      <input
                        style={INPUT}
                        aria-label={`${row.id} の関連画面`}
                        value={screensToText(row.screens)}
                        onChange={(e) =>
                          setDraft((m) =>
                            updateRow(m, row.id, { screens: textToScreens(e.target.value) }),
                          )
                        }
                      />
                    </td>
                    <td style={{ ...CELL, minWidth: 140 }}>
                      <select
                        style={INPUT}
                        aria-label={`${row.id} の機能グループ`}
                        value={row.group}
                        onChange={(e) =>
                          setDraft((m) => updateRow(m, row.id, { group: e.target.value }))
                        }
                      >
                        {draft.groups.includes(row.group) ? null : (
                          <option value={row.group} style={OPTION}>
                            {row.group || "(未選択)"}
                          </option>
                        )}
                        {draft.groups.map((group) => (
                          <option key={group} value={group} style={OPTION}>
                            {group}
                          </option>
                        ))}
                      </select>
                      {row.group_initial && row.group_initial !== row.group ? (
                        <div style={{ fontSize: 11, color: "var(--color11)" }}>
                          初期値: {row.group_initial}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ ...CELL, minWidth: 220 }}>
                      <input
                        style={INPUT}
                        aria-label={`${row.id} の概要`}
                        value={row.summary}
                        onChange={(e) =>
                          setDraft((m) => updateRow(m, row.id, { summary: e.target.value }))
                        }
                      />
                    </td>
                    <td style={CELL}>
                      <button
                        type="button"
                        aria-label={`${row.id} を削除`}
                        onClick={() => setDraft((m) => removeRow(m, row.id))}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <StyledButton
          theme="gray"
          disabled={!stage.is_open || generating}
          onPress={() => setDraft((m) => addRow(m))}
        >
          処理を追加
        </StyledButton>
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

      {/* Phase-17-6：更新(段階2のパネルと共有するため StageIssueList へ切り出した)
         {stage.issues.length > 0 ? (
           <YStack gap="$1" aria-label="検証の結果">
             <Text fontWeight="700">検証の結果(保存した内容)</Text>
             {stage.issues.map((issue, index) => (
               <Text
                 key={`${issue.code}-${issue.target ?? ""}-${index}`}
                 color={issue.severity === "error" ? "$red10" : "$orange10"}
                 fontSize="$2"
               >
                 {issue.severity === "error" ? "エラー" : "警告"}: {issue.message}
               </Text>
             ))}
           </YStack>
         ) : null}
         ↓↓ */}
      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}

// 機能グループ1つ分。名前の入力欄は、確定(Enter・フォーカスを外す)したときに改名する。
function GroupItem({
  group,
  used,
  onRename,
  onRemove,
}: {
  group: string;
  used: boolean;
  onRename: (to: string) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(group);
  const commit = () => {
    if (text.trim() && text.trim() !== group) onRename(text);
    else setText(group);
  };
  return (
    <XStack
      gap="$1"
      alignItems="center"
      paddingHorizontal="$2"
      paddingVertical="$1"
      borderWidth={1}
      borderColor="$borderColor"
      borderRadius="$3"
    >
      <input
        style={{ ...INPUT, width: 140, border: "none" }}
        aria-label={`機能グループ「${group}」の名前`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
      />
      <button
        type="button"
        aria-label={`機能グループ「${group}」を削除`}
        title={used ? "処理が残っているグループは削除できません" : undefined}
        disabled={used}
        onClick={onRemove}
      >
        ×
      </button>
    </XStack>
  );
}
