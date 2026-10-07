// 作成：Phase-20-7｜更新：Phase-21-8,21-7(画面確認後の修正。保存バー・タブの保持),29-4
// 写経レベル: コア ── 生成は保存した選択から、まとめて(手順の無い処理)とタブごと(1処理)の2通り。
"use client";

// Phase-21-7:追記(画面確認後の修正) ── @/features/detailed-design/components/StageSaveBar.StageSaveBar
// Phase-21-8:追記 ── @/features/detailed-design/logicOps(logicIdsByKey, toLogics)
// Phase-29-4:追記 ── @/features/detailed-design/components/ProcedureSequenceView.ProcedureSequenceView
import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  MAX_PROCEDURE_TARGETS,
  type DesignStageRead,
  type ProcedureModel,
} from "@/features/detailed-design/api/types";
import { ProcedureSequenceView } from "@/features/detailed-design/components/ProcedureSequenceView";
import { ProcedureStepTable } from "@/features/detailed-design/components/ProcedureStepTable";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import { logicIdsByKey, toLogics } from "@/features/detailed-design/logicOps";
import { toModuleList } from "@/features/detailed-design/moduleListOps";
import {
  buildIndex,
  buildInvolvement,
  pendingFunctionIds,
  toggleProcedure,
  toProcedures,
} from "@/features/detailed-design/procedureOps";

// Phase-21-7:追記(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
// ストアに覚えるタブの選択の鍵(処理ごとの手順のタブ)
const TAB_KEY = "5:procedure";

// ── ここから Phase-20-7 の作成分 ──
// 外すと手順が失われる処理を外すときの確認
const UNSELECT_CONFIRM = "この処理の手順は、保存すると失われます。外しますか?";

// 段階5(主要処理の手順)の作業領域の中身。手順を書く処理の選択、AIの下書きの生成(手順の無い処理を
// まとめて・タブごとに1処理)、索引、処理 × モジュールの関与表、処理ごとの手順の表(タブ)、保存、検証の
// 結果を持つ。入力の段階1(機能一覧)と段階4(モジュール一覧のパス)はストアの段階の一覧から読む。
// 編集中の内容はこのコンポーネントの中だけに持ち、保存して初めてサーバーへ送る(段階2の DataFlowPanel
// と同じ形)。生成は保存した内容を使うので、保存していない編集がある間は押せない(Phase 20)。
// Phase-21-8:追記
// Phase-29-4:追記
// 処理のタブの表の下には、保存した手順から導いたシーケンス図(ProcedureSequenceView)を出す。
// 段階6に詳細がある手順には「詳細 L-02」のバッジを出し、押すと段階6のその関数へ移る(保存していない
// 編集があれば確かめる)。段階6の「呼ばれる手順」から移ってきたときは、その処理のタブを開いて手順の行を
// 強調する(Phase 21)。
// ── ここから Phase-20-7 の作成分 ──
export function ProcedurePanel({
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
  const stage4Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 4)?.model ?? null,
  );
  // Phase-21-8:追記
  const stage6Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 6)?.model ?? null,
  );
  // ── ここから Phase-20-7 の作成分 ──
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);
  // Phase-21-8:追記
  const focus = useDetailedDesignStore((s) => s.focus);
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  const clearFocus = useDetailedDesignStore((s) => s.clearFocus);
  // ── ここから Phase-20-7 の作成分 ──

  const functionList = toFunctionList(stage1Model);
  const modulePaths = toModuleList(stage4Model).modules.map((row) => row.path.trim());
  // Phase-21-8:追記
  const detailIds = logicIdsByKey(toLogics(stage6Model));
  // ── ここから Phase-20-7 の作成分 ──
  const saved = toProcedures(stage.model);
  const [draft, setDraft] = useState<ProcedureModel>(saved);
  // Phase-21-8：更新(段階6から移ってきたときは、その処理のタブと手順の行から始める)
  // const [selected, setSelected] = useState<string | null>(null);
  // ↓↓
  // 段階6から移ってきたとき(focus の target は手順ID F-01#4)は、その処理のタブと手順の行から始める
  const [highlighted] = useState<string | null>(() =>
    focus?.stage === stage.stage ? focus.target : null,
  );
  // Phase-21-7：更新(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
  // const [selected, setSelected] = useState<string | null>(() =>
  //   highlighted !== null ? highlighted.split("#")[0] : null,
  // );
  // ↓↓
  // タブの選択はストアにも覚えておき、保存・生成でパネルが作り直されても同じタブに戻す
  const setTab = useDetailedDesignStore((s) => s.setTab);
  const [selected, setSelectedState] = useState<string | null>(() =>
    highlighted !== null
      ? highlighted.split("#")[0]
      : (useDetailedDesignStore.getState().tabs[TAB_KEY] ?? null),
  );
  const setSelected = (functionId: string | null) => {
    setSelectedState(functionId);
    setTab(TAB_KEY, functionId);
  };
  // ── ここから Phase-21-8 の作成分 ──
  // 移る前の確認を出している移動先(段階6の関数の鍵)
  const [leaving, setLeaving] = useState<string | null>(null);
  // ── ここから Phase-20-7 の作成分 ──
  // 作り直しの確認を出している処理
  const [confirming, setConfirming] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Phase-21-8:追記
  // 移動先は一度読んだら消す(段階を選び直したときに、また同じ行へ移らないように)
  useEffect(() => {
    if (focus?.stage === stage.stage) clearFocus();
  }, [focus, stage.stage, clearFocus]);

  const goToDetail = (key: string) => (dirty ? setLeaving(key) : jumpTo(6, key));
  // ── ここから Phase-20-7 の作成分 ──

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const pending = pendingFunctionIds(saved);
  const tooMany = pending.length > MAX_PROCEDURE_TARGETS;
  const canGenerate = stage.is_open && !generating && !requestingGeneration && !dirty;

  const ids = draft.procedures.map((p) => p.function_id);
  const current = selected !== null && ids.includes(selected) ? selected : (ids[0] ?? null);
  const savedCurrent = saved.procedures.find((p) => p.function_id === current) ?? null;
  const index = buildIndex(draft, functionList);
  const involvement = buildInvolvement(draft, modulePaths);
  const nameOf = (id: string) => functionList.functions.find((fn) => fn.id === id)?.name ?? "";

  const regenerate = (functionId: string) => {
    setConfirming(null);
    void generate(projectId, stage.stage, [functionId]);
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

      {/* ── ここから Phase-20-7 の作成分 ── */}
      <YStack gap="$2">
        <Text fontWeight="700">手順を書く処理</Text>
        <Paragraph color="$color11" fontSize="$2">
          並行制御・外部サービス・部分失敗の扱いなど、込み入った処理だけを選びます。単純な処理は、段階2の
          処理概要表の行で済ませます。選んだら保存してから下書きを生成してください。
        </Paragraph>
        <XStack gap="$3" flexWrap="wrap">
          {functionList.functions.map((fn) => {
            const checked = ids.includes(fn.id);
            return (
              <label key={fn.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={generating || !stage.is_open}
                  onChange={(e) => {
                    const steps = draft.procedures.find((p) => p.function_id === fn.id)?.steps;
                    if (!e.target.checked && steps?.length && !window.confirm(UNSELECT_CONFIRM)) {
                      return;
                    }
                    setDraft((m) => toggleProcedure(m, functionList, fn.id, e.target.checked));
                  }}
                />
                <span style={{ color: "var(--color)" }}>
                  {fn.id} {fn.name}
                </span>
              </label>
            );
          })}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={!canGenerate || pending.length === 0 || tooMany}
            onPress={() => void generate(projectId, stage.stage)}
          >
            {generating
              ? "生成中"
              : `手順の無い処理の下書きを生成する(${pending.length}件)`}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "保存してから生成してください(生成は保存した選択を使います)。"
              : tooMany
                ? `まとめて生成できるのは ${MAX_PROCEDURE_TARGETS} 件までです。タブごとに生成してください。`
                : "データフロー・モジュール一覧から、AI が処理ごとに手順を下書きします。手順のある処理はそのまま残ります。"}
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
        open={confirming !== null}
        title="この処理の手順を作り直しますか?"
        description={
          <>
            AI が {confirming} の手順を作り直します。この処理の手順の手直しは失われます(選定理由は残り、
            他の処理の手順はそのまま残ります)。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認はやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={() => confirming !== null && regenerate(confirming)}
        onCancel={() => setConfirming(null)}
      />

      {index.length > 0 ? (
        <YStack gap="$2">
          <Text fontWeight="700">索引</Text>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE} aria-label="手順の索引">
              <thead>
                <tr>
                  <th style={HEAD}>処理ID</th>
                  <th style={HEAD}>名称</th>
                  <th style={HEAD}>トリガー</th>
                  <th style={HEAD}>選定理由</th>
                  <th style={HEAD}>手順数</th>
                </tr>
              </thead>
              <tbody>
                {index.map((row) => (
                  <tr key={row.procedure.function_id}>
                    <td style={{ ...CELL, ...MONO }}>{row.procedure.function_id}</td>
                    <td style={CELL}>{row.fn?.name ?? "(機能一覧に無い処理)"}</td>
                    <td style={{ ...CELL, ...MONO }}>{row.fn?.trigger ?? ""}</td>
                    <td style={CELL}>{row.procedure.reason}</td>
                    <td style={CELL}>{row.stepCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </YStack>
      ) : null}

      {involvement.modules.length > 0 ? (
        <YStack gap="$2">
          <Text fontWeight="700">処理 × モジュールの関与表</Text>
          <Paragraph color="$color11" fontSize="$2">
            セルは、そのモジュールが呼ばれる手順の番号です(列は段階4のモジュール一覧のパス)。
          </Paragraph>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE} aria-label="処理 × モジュールの関与表">
              <thead>
                <tr>
                  <th style={HEAD}>処理</th>
                  {involvement.modules.map((path) => (
                    <th key={path} style={{ ...HEAD, ...MONO }}>
                      {path}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.procedures.map((p) => (
                  <tr key={p.function_id}>
                    <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                      {p.function_id} {nameOf(p.function_id)}
                    </td>
                    {involvement.modules.map((path) => (
                      <td key={path} style={{ ...CELL, ...MONO }}>
                        {(involvement.cells.get(p.function_id)?.get(path) ?? []).join(", ")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </YStack>
      ) : null}

      {generating ? (
        <Text role="status" color="$color11">
          手順: 生成中
        </Text>
      ) : current !== null ? (
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label="処理ごとの手順">
            {ids.map((id) => (
              <StyledButton
                key={id}
                size="$3"
                role="tab"
                aria-selected={id === current}
                theme={id === current ? undefined : "gray"}
                onPress={() => setSelected(id)}
              >
                {`${id} ${nameOf(id)}`}
              </StyledButton>
            ))}
          </XStack>
          {savedCurrent ? (
            <XStack gap="$3" alignItems="center" flexWrap="wrap">
              <StyledButton
                theme="gray"
                disabled={!canGenerate}
                onPress={() =>
                  savedCurrent.steps.length > 0
                    ? setConfirming(savedCurrent.function_id)
                    : regenerate(savedCurrent.function_id)
                }
              >
                {savedCurrent.steps.length > 0
                  ? "この処理の手順を作り直す"
                  : "この処理の下書きを生成する"}
              </StyledButton>
            </XStack>
          ) : (
            <Text color="$color11" fontSize="$2">
              保存すると、この処理の下書きを生成できます。
            </Text>
          )}
          <ProcedureStepTable
            model={draft}
            functionId={current}
            modulePaths={modulePaths}
            disabled={!stage.is_open}
            onChange={setDraft}
            // Phase-21-8:追記
            detailIds={detailIds}
            onDetailPress={goToDetail}
            highlightedStep={highlighted}
          />
          {/* Phase-29-4:追記 */}
          {savedCurrent && savedCurrent.steps.length > 0 ? (
            <ProcedureSequenceView
              projectId={projectId}
              functionId={savedCurrent.function_id}
              version={stage.version}
              dirty={dirty}
            />
          ) : null}
        </YStack>
      ) : (
        <Text color="$color11">手順を書く処理はまだ選ばれていません。</Text>
      )}

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

      {/* Phase-21-8:追記 */}
      <ConfirmDialog
        open={leaving !== null}
        title="段階6へ移りますか?"
        description="保存していない編集は失われます。"
        confirmLabel="移る"
        onConfirm={() => {
          if (leaving !== null) jumpTo(6, leaving);
          setLeaving(null);
        }}
        onCancel={() => setLeaving(null)}
      />

      {/* ── ここから Phase-20-7 の作成分 ── */}
      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}
