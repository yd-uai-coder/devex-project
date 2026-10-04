// 作成：Phase-21-7｜更新：Phase-21-8,21-7(画面確認後の修正。処理ごとのタブ・二重タブ・上下の保存バー)
// 写経レベル: コア ── 候補は段階5から導き、飛ばす = 0件を保存して承認。候補と詳細は処理のタブで切り替え、データと L-ID は全体のまま。
"use client";

// Phase-21-8:追記 ── react.useRef
// Phase-21-7:追記(画面確認後の修正) ── react.CSSProperties, @/features/detailed-design/components/StageSaveBar.StageSaveBar, @/features/detailed-design/functionListOps.toFunctionList, @/features/detailed-design/logicOps(candidatesByProcedure, logicIdsByKey, logicStatus, pendingInTab, selectAll, TabCandidate。logicId・pendingLogics は使わなくなった)
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  MAX_LOGIC_TARGETS,
  type DesignStageRead,
  type LogicModel,
  type LogicTarget,
} from "@/features/detailed-design/api/types";
import { LogicSpecEditor } from "@/features/detailed-design/components/LogicSpecEditor";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { toFunctionList } from "@/features/detailed-design/functionListOps";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import {
  buildReverseIndex,
  candidatesByProcedure,
  isDrafted,
  keyOf,
  logicCandidates,
  logicIdsByKey,
  logicStatus,
  pendingInTab,
  selectAll,
  toggleLogic,
  toLogics,
  type TabCandidate,
} from "@/features/detailed-design/logicOps";
import { toProcedures } from "@/features/detailed-design/procedureOps";

// 外すと詳細が失われる関数を外すときの確認
const UNSELECT_CONFIRM = "この関数の詳細は、保存すると失われます。外しますか?";

// Phase-21-7:追記(画面確認後の修正)
// ストアに覚えるタブの選択の鍵(外側 = 処理、内側 = 関数)
const OUTER_TAB_KEY = "6:outer";
const INNER_TAB_KEY = "6:inner";

// 外側のタブの、段階5を直して呼ばれなくなった関数のタブ(処理ID と重ならない値)
const ORPHAN_TAB = "__orphans__";

// 他の処理の手順のバッジ・共通の印・状態のラベルの見た目
const OTHER_BADGE: CSSProperties = {
  ...BADGE,
  color: "var(--color11)",
  borderColor: "var(--borderColor)",
  background: "transparent",
};
const LABEL: CSSProperties = { fontSize: 11, padding: "0 6px", borderRadius: 4 };
const SHARED: CSSProperties = { ...LABEL, color: "var(--purple11)", background: "var(--purple3)" };
const DRAFTED: CSSProperties = { ...LABEL, color: "var(--green11)", background: "var(--green3)" };
const PENDING: CSSProperties = { ...LABEL, color: "var(--orange11)", background: "var(--orange3)" };
// ── ここから Phase-21-7 の作成分 ──

// 段階6(処理ロジックの詳細。任意)の作業領域の中身。詳細を書く関数の選択(段階5の手順が呼ぶ関数)、
// AIの下書きの生成(詳細の無い関数をまとめて・タブごとに1関数)、逆引き(L-ID/関数/モジュール/
// 呼ばれる手順)、関数ごとの詳細(タブ)、保存、段階6を飛ばす操作、検証の結果を持つ。入力の段階5の手順は
// ストアの段階の一覧から読む。編集中の内容はこのコンポーネントの中だけに持つ(段階5の ProcedurePanel と
// 同じ形)。「段階6を飛ばす」は、0件を保存して承認する(Phase 21 の決定)。
// Phase-21-8:追記
// 「呼ばれる手順」のバッジを押すと段階5のその手順へ移る(保存していない編集があれば確かめる)。段階5の
// 「詳細」バッジから移ってきたときは、その関数を最初に呼ぶ処理のタブとその関数のタブを開いて強調する。
// Phase-21-7:追記(画面確認後の修正)
// 候補が多くても扱えるよう、段階5の処理ごとの外側のタブで候補と詳細を切り替える(詳細は 処理 → 関数 の
// 二重のタブ)。共通の関数は呼ぶ処理すべてのタブに出し、どこで編集しても同じ1件を編集する。L-ID・逆引きは
// 全体の並び順のまま(Phase 21 の画面確認後)。
export function LogicPanel({
  projectId,
  stage,
  onDirtyChange,
  onApprove,
}: {
  projectId: string;
  stage: DesignStageRead;
  onDirtyChange: (dirty: boolean) => void;
  onApprove?: () => void;
}) {
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore((s) => s.requestingGeneration);
  // Phase-21-7:追記(画面確認後の修正)
  const stage1Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 1)?.model ?? null,
  );
  // ── ここから Phase-21-7 の作成分 ──
  const stage5Model = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 5)?.model ?? null,
  );
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);
  // Phase-21-8:追記
  const focus = useDetailedDesignStore((s) => s.focus);
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  const clearFocus = useDetailedDesignStore((s) => s.clearFocus);
  // ── ここから Phase-21-7 の作成分 ──

  const procedures = toProcedures(stage5Model);
  const candidates = logicCandidates(procedures);
  // Phase-21-7:追記(画面確認後の修正)
  const tabs = candidatesByProcedure(procedures);
  const functionList = toFunctionList(stage1Model);
  // ── ここから Phase-21-7 の作成分 ──
  const saved = toLogics(stage.model);
  const [draft, setDraft] = useState<LogicModel>(saved);
  // Phase-21-8：更新(段階5から移ってきたときは、その関数のタブから始める)
  // const [selected, setSelected] = useState<string | null>(null);
  // ↓↓
  // 段階5から移ってきたとき(focus の target は関数の鍵)は、その関数のタブから始める
  const [highlighted] = useState<string | null>(() =>
    focus?.stage === stage.stage ? focus.target : null,
  );
  // Phase-21-7：更新(画面確認後の修正。保存・生成でパネルが作り直されてもタブを保つ)
  // const [selected, setSelected] = useState<string | null>(highlighted);
  // ↓↓
  // タブの選択はストアにも覚えておき、保存・生成でパネルが作り直されても同じタブに戻す
  const setTab = useDetailedDesignStore((s) => s.setTab);
  const [selected, setSelectedState] = useState<string | null>(
    () => highlighted ?? useDetailedDesignStore.getState().tabs[INNER_TAB_KEY] ?? null,
  );
  // Phase-21-7:追記(画面確認後の修正)
  // 外側のタブ(処理ID)。移ってきたときは、その関数を最初に呼ぶ処理
  const [outerTab, setOuterTabState] = useState<string | null>(() =>
    highlighted !== null
      ? (tabs.find((tab) => tab.candidates.some((c) => keyOf(c) === highlighted))?.functionId ??
        ORPHAN_TAB)
      : (useDetailedDesignStore.getState().tabs[OUTER_TAB_KEY] ?? null),
  );
  const setSelected = (key: string | null) => {
    setSelectedState(key);
    setTab(INNER_TAB_KEY, key);
  };
  const setOuterTab = (functionId: string | null) => {
    setOuterTabState(functionId);
    setTab(OUTER_TAB_KEY, functionId);
  };
  // Phase-21-8:追記
  // 移る前の確認を出している移動先(段階5の手順ID)
  const [leaving, setLeaving] = useState<string | null>(null);
  const editor = useRef<HTMLDivElement>(null);
  // ── ここから Phase-21-7 の作成分 ──
  // 作り直しの確認を出している関数
  const [confirming, setConfirming] = useState<LogicTarget | null>(null);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  // Phase-21-8:追記
  // 移動先は一度読んだら消し、強調した関数の詳細を見える位置へ送る
  useEffect(() => {
    if (focus?.stage === stage.stage) clearFocus();
  }, [focus, stage.stage, clearFocus]);
  useEffect(() => {
    if (highlighted !== null) editor.current?.scrollIntoView({ block: "start" });
  }, [highlighted]);

  const goToStep = (stepId: string) => (dirty ? setLeaving(stepId) : jumpTo(5, stepId));
  // ── ここから Phase-21-7 の作成分 ──

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  // Phase-21-7：削除(画面確認後の修正。全体の「詳細の無い関数の下書きを生成する」をなくし、タブの生成だけにした)
  // const pending = pendingLogics(saved);
  // const tooMany = pending.length > MAX_LOGIC_TARGETS;
  // ── ここから Phase-21-7 の作成分 ──
  const canGenerate = stage.is_open && !generating && !requestingGeneration && !dirty;
  const skipped = stage.state === "approved" && saved.logics.length === 0 && stage.version !== null;

  // Phase-21-7：更新(画面確認後の修正。外側の処理のタブ・内側の関数のタブを導く)
  // const keys = draft.logics.map(keyOf);
  // const current = selected !== null && keys.includes(selected) ? selected : (keys[0] ?? null);
  // const currentIndex = current !== null ? keys.indexOf(current) : -1;
  // const savedCurrent = saved.logics.find((row) => keyOf(row) === current) ?? null;
  // const reverse = buildReverseIndex(draft, procedures);
  // // 段階5を直して呼ばれなくなった関数も、外せるように選択の一覧に残す
  // const orphans = draft.logics.filter((row) => !candidates.some((c) => keyOf(c) === keyOf(row)));
  // ↓↓
  const reverse = buildReverseIndex(draft, procedures);
  const ids = logicIdsByKey(draft);
  const stepIdsOf = new Map(reverse.map((r) => [keyOf(r.row), r.stepIds]));
  // 段階5を直して呼ばれなくなった関数も、外せるように別のタブに残す
  const orphans = draft.logics.filter((row) => !candidates.some((c) => keyOf(c) === keyOf(row)));
  const sharedKeys = new Set(
    tabs.flatMap((tab) => tab.candidates.filter((c) => c.shared).map(keyOf)),
  );
  const outerIds = [...tabs.map((tab) => tab.functionId), ...(orphans.length > 0 ? [ORPHAN_TAB] : [])];
  const outer = outerTab !== null && outerIds.includes(outerTab) ? outerTab : (outerIds[0] ?? null);
  const tabCandidates: TabCandidate[] =
    outer === ORPHAN_TAB
      ? orphans.map((row) => ({ module: row.module, function: row.function, stepIds: [], shared: false }))
      : (tabs.find((tab) => tab.functionId === outer)?.candidates ?? []);
  const unselectedInTab = tabCandidates.filter((c) => logicStatus(draft, keyOf(c)) === "unselected").length;
  // タブの生成は保存した内容から(1回 MAX_LOGIC_TARGETS 件まで。残りはもう一度押す)
  const tabPending = pendingInTab(saved, tabCandidates);
  const tabTargets = tabPending.slice(0, MAX_LOGIC_TARGETS);
  // タブの生成ボタンの出し分け: 編集中にチェック済みの未生成があれば「生成前に保存する」、保存済みで
  // 未生成があれば生成、どちらも無ければ (0件) で押せない(Phase 21 の2回目の画面確認後)
  const draftPendingInTab = pendingInTab(draft, tabCandidates).length;
  const tabAction: "save" | "generate" | "none" =
    dirty && draftPendingInTab > 0 ? "save" : !dirty && tabPending.length > 0 ? "generate" : "none";
  // 内側のタブ: このタブの候補のうち選んだ関数(全体の並び順)
  const tabKeys = new Set(tabCandidates.map(keyOf));
  const innerKeys = draft.logics.map(keyOf).filter((key) => tabKeys.has(key));
  const current =
    selected !== null && innerKeys.includes(selected) ? selected : (innerKeys[0] ?? null);
  const savedCurrent = saved.logics.find((row) => keyOf(row) === current) ?? null;
  const nameOf = (id: string) => functionList.functions.find((fn) => fn.id === id)?.name ?? "";
  // ── ここから Phase-21-7 の作成分 ──

  const regenerate = (target: LogicTarget) => {
    setConfirming(null);
    void generate(projectId, stage.stage, undefined, [target]);
  };

  const skip = async () => {
    setConfirmingSkip(false);
    if (await save(projectId, stage.stage, { logics: [] })) onApprove?.();
  };

  // Phase-21-7:追記(画面確認後の修正。上下の保存バーで同じボタンを使う)
  const skipButton = (
    <StyledButton
      theme="gray"
      disabled={saving || generating || !stage.is_open || skipped}
      onPress={() => setConfirmingSkip(true)}
    >
      段階6を飛ばす(06を書かない)
    </StyledButton>
  );

  // ── ここから Phase-21-7 の作成分 ──
  const toggle = (target: LogicTarget, checked: boolean) => {
    const row = draft.logics.find((item) => keyOf(item) === keyOf(target));
    if (!checked && row && isDrafted(row) && !window.confirm(UNSELECT_CONFIRM)) return;
    setDraft((m) => toggleLogic(m, candidates, target, checked));
  };

  // Phase-21-7：更新(画面確認後の修正。上下の保存バー、処理ごとの外側のタブ、候補の共通の印・状態、
  // タブ単位の選択と生成、詳細の二重タブ。21-8 の段階またぎの部分は新しい側にもそのまま含む)
  // return (
  //   <YStack gap="$4">
  //     <YStack gap="$2">
  //       <Text fontWeight="700">詳細を書く関数</Text>
  //       <Paragraph color="$color11" fontSize="$2">
  //         段階5の手順が呼ぶ関数から、計算・判定・状態の変化が込み入ったものだけを選びます(06 は任意です)。
  //         選んだら保存してから下書きを生成してください。06 を書かないときは「段階6を飛ばす」を押します。
  //       </Paragraph>
  //       {candidates.length === 0 && orphans.length === 0 ? (
  //         <Text color="$color11">
  //           選べる関数がありません(段階5の手順に、モジュールの関数を呼ぶ行がありません)。
  //         </Text>
  //       ) : (
  //         <YStack gap="$1">
  //           {[...candidates, ...orphans.map((row) => ({ ...row, stepIds: [] as string[] }))].map(
  //             (c) => (
  //               <label
  //                 key={keyOf(c)}
  //                 style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--color)" }}
  //               >
  //                 <input
  //                   type="checkbox"
  //                   aria-label={`${c.module} の ${c.function}`}
  //                   checked={keys.includes(keyOf(c))}
  //                   disabled={generating || !stage.is_open}
  //                   onChange={(e) => toggle(c, e.target.checked)}
  //                 />
  //                 <span style={MONO}>{c.function}</span>
  //                 <span style={{ ...MONO, color: "var(--color11)" }}>({c.module})</span>
  //                 {c.stepIds.length === 0 ? (
  //                   <span style={{ fontSize: 12, color: "var(--red10)" }}>呼ぶ手順がありません</span>
  //                 ) : (
  //                   c.stepIds.map((id) => (
  //                     <span key={id} style={BADGE}>
  //                       {id}
  //                     </span>
  //                   ))
  //                 )}
  //               </label>
  //             ),
  //           )}
  //         </YStack>
  //       )}
  //     </YStack>
  //
  //     <YStack gap="$2">
  //       <XStack gap="$3" alignItems="center" flexWrap="wrap">
  //         <StyledButton
  //           disabled={!canGenerate || pending.length === 0 || tooMany}
  //           onPress={() => void generate(projectId, stage.stage)}
  //         >
  //           {generating ? "生成中" : `詳細の無い関数の下書きを生成する(${pending.length}件)`}
  //         </StyledButton>
  //         <Text color="$color11" fontSize="$2">
  //           {dirty
  //             ? "保存してから生成してください(生成は保存した選択を使います)。"
  //             : tooMany
  //               ? `まとめて生成できるのは ${MAX_LOGIC_TARGETS} 件までです。タブごとに生成してください。`
  //               : "呼ばれる手順・モジュール一覧から、AI が関数ごとに詳細を下書きします。詳細のある関数はそのまま残ります。"}
  //         </Text>
  //       </XStack>
  //       {generating && timedOut ? (
  //         <Text role="status" color="$color11">
  //           生成に時間がかかっています。しばらくしてから画面を読み込み直してください。
  //         </Text>
  //       ) : null}
  //       {stage.generation_status === "failed" && stage.generation_error ? (
  //         <Text role="alert" color="$red10">
  //           {stage.generation_error}
  //         </Text>
  //       ) : null}
  //     </YStack>
  //
  //     <ConfirmDialog
  //       open={confirming !== null}
  //       title="この関数の詳細を作り直しますか?"
  //       description={
  //         <>
  //           AI が {confirming?.function} の詳細を作り直します。この関数の詳細の手直しは失われます(他の関数の
  //           詳細はそのまま残ります)。
  //           {stage.state === "approved" || stage.state === "outdated"
  //             ? "段階の承認はやり直しになります。"
  //             : ""}
  //         </>
  //       }
  //       confirmLabel="作り直す"
  //       onConfirm={() => confirming !== null && regenerate(confirming)}
  //       onCancel={() => setConfirming(null)}
  //     />
  //
  //     {reverse.length > 0 ? (
  //       <YStack gap="$2">
  //         <Text fontWeight="700">逆引き</Text>
  //         <div style={{ overflowX: "auto" }}>
  //           <table style={TABLE} aria-label="処理ロジックの逆引き">
  //             <thead>
  //               <tr>
  //                 <th style={HEAD}>L-ID</th>
  //                 <th style={HEAD}>関数</th>
  //                 <th style={HEAD}>モジュール</th>
  //                 <th style={HEAD}>呼ばれる手順</th>
  //               </tr>
  //             </thead>
  //             <tbody>
  //               {reverse.map(({ id, row, stepIds }) => (
  //                 <tr key={keyOf(row)}>
  //                   <td style={{ ...CELL, ...MONO }}>{id}</td>
  //                   <td style={{ ...CELL, ...MONO }}>{row.function}</td>
  //                   <td style={{ ...CELL, ...MONO }}>{row.module}</td>
  //                   <td style={{ ...CELL, ...MONO }}>{stepIds.join(", ") || "—"}</td>
  //                 </tr>
  //               ))}
  //             </tbody>
  //           </table>
  //         </div>
  //       </YStack>
  //     ) : null}
  //
  //     {generating ? (
  //       <Text role="status" color="$color11">
  //         詳細: 生成中
  //       </Text>
  //     ) : current !== null ? (
  //       <YStack gap="$2">
  //         <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label="関数ごとの詳細">
  //           {draft.logics.map((row, i) => (
  //             <StyledButton
  //               key={keyOf(row)}
  //               size="$3"
  //               role="tab"
  //               aria-selected={keyOf(row) === current}
  //               theme={keyOf(row) === current ? undefined : "gray"}
  //               onPress={() => setSelected(keyOf(row))}
  //             >
  //               {`${logicId(i)} ${row.function}`}
  //             </StyledButton>
  //           ))}
  //         </XStack>
  //         {savedCurrent ? (
  //           <XStack gap="$3" alignItems="center" flexWrap="wrap">
  //             <StyledButton
  //               theme="gray"
  //               disabled={!canGenerate}
  //               onPress={() =>
  //                 isDrafted(savedCurrent) ? setConfirming(savedCurrent) : regenerate(savedCurrent)
  //               }
  //             >
  //               {isDrafted(savedCurrent) ? "この関数の詳細を作り直す" : "この関数の下書きを生成する"}
  //             </StyledButton>
  //           </XStack>
  //         ) : (
  //           <Text color="$color11" fontSize="$2">
  //             保存すると、この関数の下書きを生成できます。
  //           </Text>
  //         )}
  //         {/* Phase-21-8：更新(強調の枠と、呼ばれる手順のバッジから段階5へ移る onStepPress)
  //            <LogicSpecEditor
  //              model={draft}
  //              logicKey={current}
  //              logicId={logicId(currentIndex)}
  //              stepIds={reverse[currentIndex]?.stepIds ?? []}
  //              disabled={!stage.is_open}
  //              onChange={setDraft}
  //            />
  //            ↓↓ */}
  //         <div
  //           ref={editor}
  //           aria-current={current === highlighted ? "true" : undefined}
  //           style={
  //             current === highlighted
  //               ? { outline: "2px solid var(--yellow8)", outlineOffset: 4, borderRadius: 4 }
  //               : undefined
  //           }
  //         >
  //           <LogicSpecEditor
  //             model={draft}
  //             logicKey={current}
  //             logicId={logicId(currentIndex)}
  //             stepIds={reverse[currentIndex]?.stepIds ?? []}
  //             disabled={!stage.is_open}
  //             onChange={setDraft}
  //             onStepPress={goToStep}
  //           />
  //         </div>
  //       </YStack>
  //     ) : skipped ? (
  //       <Text color="$color11">段階6は飛ばしました(06 章は「省略」になります)。</Text>
  //     ) : (
  //       <Text color="$color11">詳細を書く関数はまだ選ばれていません。</Text>
  //     )}
  //
  //     <XStack gap="$3" alignItems="center" flexWrap="wrap">
  //       <StyledButton
  //         disabled={!dirty || saving || generating || !stage.is_open}
  //         onPress={() => void save(projectId, stage.stage, draft)}
  //       >
  //         {saving ? "保存しています..." : "保存する"}
  //       </StyledButton>
  //       <StyledButton
  //         theme="gray"
  //         disabled={saving || generating || !stage.is_open || skipped}
  //         onPress={() => setConfirmingSkip(true)}
  //       >
  //         段階6を飛ばす(06を書かない)
  //       </StyledButton>
  //       {dirty ? (
  //         <Text color="$color11" fontSize="$2">
  //           保存していない編集があります。
  //         </Text>
  //       ) : null}
  //     </XStack>
  //
  //     <ConfirmDialog
  //       open={confirmingSkip}
  //       title="段階6を飛ばしますか?"
  //       description={
  //         <>
  //           06(処理ロジックの詳細)を書かずに、段階6を承認します。
  //           {saved.logics.length > 0 || draft.logics.length > 0
  //             ? "選んだ関数とその詳細は消えます。"
  //             : ""}
  //           後から関数を選び直して承認し直すこともできます。
  //         </>
  //       }
  //       confirmLabel="飛ばして承認する"
  //       onConfirm={() => void skip()}
  //       onCancel={() => setConfirmingSkip(false)}
  //     />
  //
  //     {/* Phase-21-8:追記 */}
  //     <ConfirmDialog
  //       open={leaving !== null}
  //       title="段階5へ移りますか?"
  //       description="保存していない編集は失われます。"
  //       confirmLabel="移る"
  //       onConfirm={() => {
  //         if (leaving !== null) jumpTo(5, leaving);
  //         setLeaving(null);
  //       }}
  //       onCancel={() => setLeaving(null)}
  //     />
  //
  //     {/* ── ここから Phase-21-7 の作成分 ── */}
  //     <StageIssueList issues={stage.issues} />
  //   </YStack>
  // );
  // ↓↓
  return (
    <YStack gap="$4">
      <StageSaveBar
        dirty={dirty}
        saving={saving}
        disabled={generating || !stage.is_open}
        onSave={() => void save(projectId, stage.stage, draft)}
        trailing={skipButton}
      />

      <YStack gap="$2">
        <Text fontWeight="700">詳細を書く関数</Text>
        <Paragraph color="$color11" fontSize="$2">
          段階5の手順が呼ぶ関数から、計算・判定・状態の変化が込み入ったものだけを選びます(06 は任意です)。
          処理のタブごとに選び、保存してから下書きを生成してください。06 を書かないときは「段階6を飛ばす」を
          押します。
        </Paragraph>

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
        title="この関数の詳細を作り直しますか?"
        description={
          <>
            AI が {confirming?.function} の詳細を作り直します。この関数の詳細の手直しは失われます(他の関数の
            詳細はそのまま残ります)。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認はやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={() => confirming !== null && regenerate(confirming)}
        onCancel={() => setConfirming(null)}
      />

      {tabs.length === 0 && orphans.length === 0 ? (
        <Text color="$color11">
          選べる関数がありません(段階5の手順に、モジュールの関数を呼ぶ行がありません)。
        </Text>
      ) : (
        <YStack gap="$3">
          {/* 外側: 段階5の処理ごとのタブ。候補の選択と詳細の両方をこのタブで切り替える */}
          <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label="処理ごとのタブ">
            {tabs.map((tab) => (
              <StyledButton
                key={tab.functionId}
                size="$3"
                role="tab"
                aria-selected={tab.functionId === outer}
                theme={tab.functionId === outer ? undefined : "gray"}
                onPress={() => setOuterTab(tab.functionId)}
              >
                {`${tab.functionId} ${nameOf(tab.functionId)}`}
              </StyledButton>
            ))}
            {orphans.length > 0 ? (
              <StyledButton
                size="$3"
                role="tab"
                aria-selected={outer === ORPHAN_TAB}
                theme={outer === ORPHAN_TAB ? undefined : "gray"}
                onPress={() => setOuterTab(ORPHAN_TAB)}
              >
                {`呼ばれていない関数(${orphans.length})`}
              </StyledButton>
            ) : null}
          </XStack>

          <YStack gap="$1">
            {tabCandidates.map((c) => {
              const key = keyOf(c);
              const status = logicStatus(draft, key);
              return (
                <label
                  key={key}
                  style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", color: "var(--color)" }}
                >
                  <input
                    type="checkbox"
                    aria-label={`${c.module} の ${c.function}`}
                    checked={status !== "unselected"}
                    disabled={generating || !stage.is_open}
                    onChange={(e) => toggle(c, e.target.checked)}
                  />
                  <span style={MONO}>{c.function}</span>
                  <span style={{ ...MONO, color: "var(--color11)" }}>({c.module})</span>
                  {c.stepIds.length === 0 ? (
                    <span style={{ fontSize: 12, color: "var(--red10)" }}>呼ぶ手順がありません</span>
                  ) : (
                    c.stepIds.map((id) => (
                      <span
                        key={id}
                        style={id.startsWith(`${outer}#`) ? BADGE : OTHER_BADGE}
                        title={id.startsWith(`${outer}#`) ? undefined : "他の処理の手順"}
                      >
                        {id}
                      </span>
                    ))
                  )}
                  {c.shared ? <span style={SHARED}>共通</span> : null}
                  {status === "unselected" ? null : (
                    <span style={status === "drafted" ? DRAFTED : PENDING}>
                      {status === "drafted" ? "生成済" : "未生成"}
                    </span>
                  )}
                </label>
              );
            })}
          </YStack>

          {outer !== ORPHAN_TAB ? (
            <XStack gap="$3" alignItems="center" flexWrap="wrap">
              <StyledButton
                theme="gray"
                disabled={generating || !stage.is_open || unselectedInTab === 0}
                onPress={() => setDraft((m) => selectAll(m, candidates, tabCandidates))}
              >
                {`このタブの未選択をすべて選ぶ(${unselectedInTab}件)`}
              </StyledButton>
              {tabAction === "save" ? (
                <StyledButton
                  theme="green"
                  disabled={saving || generating || !stage.is_open}
                  onPress={() => void save(projectId, stage.stage, draft)}
                >
                  {saving ? "保存しています..." : "生成前に保存する"}
                </StyledButton>
              ) : tabAction === "generate" ? (
                <StyledButton
                  theme="green"
                  disabled={!canGenerate}
                  onPress={() => void generate(projectId, stage.stage, undefined, tabTargets)}
                >
                  {`このタブの未生成を生成する(${tabTargets.length}件)`}
                </StyledButton>
              ) : (
                <StyledButton theme="gray" disabled>
                  このタブの未生成を生成する(0件)
                </StyledButton>
              )}
              {tabAction === "generate" && tabPending.length > MAX_LOGIC_TARGETS ? (
                <Text color="$color11" fontSize="$2">
                  {`1回に生成するのは ${MAX_LOGIC_TARGETS} 件までです。残り ${tabPending.length - MAX_LOGIC_TARGETS} 件はもう一度押してください。`}
                </Text>
              ) : null}
            </XStack>
          ) : null}

          {reverse.length > 0 ? (
            <YStack gap="$2">
              <Text fontWeight="700">逆引き</Text>
              <div style={{ overflowX: "auto" }}>
                <table style={TABLE} aria-label="処理ロジックの逆引き">
                  <thead>
                    <tr>
                      <th style={HEAD}>L-ID</th>
                      <th style={HEAD}>関数</th>
                      <th style={HEAD}>モジュール</th>
                      <th style={HEAD}>呼ばれる手順</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reverse.map(({ id, row, stepIds }) => (
                      <tr key={keyOf(row)}>
                        <td style={{ ...CELL, ...MONO }}>{id}</td>
                        <td style={{ ...CELL, ...MONO }}>{row.function}</td>
                        <td style={{ ...CELL, ...MONO }}>{row.module}</td>
                        <td style={{ ...CELL, ...MONO }}>{stepIds.join(", ") || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </YStack>
          ) : null}

          {generating ? (
            <Text role="status" color="$color11">
              詳細: 生成中
            </Text>
          ) : current !== null ? (
            <YStack gap="$2">
              {/* 内側: このタブの処理から呼ばれる、選んだ関数のタブ(L-ID は全体の並び順) */}
              <XStack gap="$2" flexWrap="wrap" role="tablist" aria-label="関数ごとの詳細">
                {innerKeys.map((key) => {
                  const row = draft.logics.find((item) => keyOf(item) === key);
                  const shared = sharedKeys.has(key);
                  return (
                    <StyledButton
                      key={key}
                      size="$3"
                      role="tab"
                      aria-selected={key === current}
                      theme={key === current ? undefined : "gray"}
                      onPress={() => setSelected(key)}
                    >
                      {`${ids.get(key) ?? ""} ${row?.function ?? ""}${shared ? "(共通)" : ""}`}
                    </StyledButton>
                  );
                })}
              </XStack>
              {savedCurrent ? (
                <XStack gap="$3" alignItems="center" flexWrap="wrap">
                  <StyledButton
                    disabled={!canGenerate}
                    onPress={() =>
                      isDrafted(savedCurrent) ? setConfirming(savedCurrent) : regenerate(savedCurrent)
                    }
                  >
                    {isDrafted(savedCurrent) ? "この関数の詳細を作り直す" : "この関数の下書きを生成する"}
                  </StyledButton>
                </XStack>
              ) : (
                <Text color="$color11" fontSize="$2">
                  保存すると、この関数の下書きを生成できます。
                </Text>
              )}
              <div
                ref={editor}
                aria-current={current === highlighted ? "true" : undefined}
                style={
                  current === highlighted
                    ? { outline: "2px solid var(--yellow8)", outlineOffset: 4, borderRadius: 4 }
                    : undefined
                }
              >
                <LogicSpecEditor
                  model={draft}
                  logicKey={current}
                  logicId={ids.get(current) ?? ""}
                  stepIds={stepIdsOf.get(current) ?? []}
                  disabled={!stage.is_open}
                  onChange={setDraft}
                  onStepPress={goToStep}
                />
              </div>
            </YStack>
          ) : (
            <Text color="$color11">このタブで詳細を書く関数はまだ選ばれていません。</Text>
          )}
        </YStack>
      )}

      {skipped ? (
        <Text color="$color11">段階6は飛ばしました(06 章は「省略」になります)。</Text>
      ) : null}

      <StageSaveBar
        dirty={dirty}
        saving={saving}
        disabled={generating || !stage.is_open}
        onSave={() => void save(projectId, stage.stage, draft)}
        trailing={skipButton}
      />

      <ConfirmDialog
        open={confirmingSkip}
        title="段階6を飛ばしますか?"
        description={
          <>
            06(処理ロジックの詳細)を書かずに、段階6を承認します。
            {saved.logics.length > 0 || draft.logics.length > 0
              ? "選んだ関数とその詳細は消えます。"
              : ""}
            後から関数を選び直して承認し直すこともできます。
          </>
        }
        confirmLabel="飛ばして承認する"
        onConfirm={() => void skip()}
        onCancel={() => setConfirmingSkip(false)}
      />

      <ConfirmDialog
        open={leaving !== null}
        title="段階5へ移りますか?"
        description="保存していない編集は失われます。"
        confirmLabel="移る"
        onConfirm={() => {
          if (leaving !== null) jumpTo(5, leaving);
          setLeaving(null);
        }}
        onCancel={() => setLeaving(null)}
      />

      <StageIssueList issues={stage.issues} />
    </YStack>
  );
}
