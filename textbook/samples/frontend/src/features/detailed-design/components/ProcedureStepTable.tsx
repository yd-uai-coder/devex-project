// 作成：Phase-20-6｜更新：Phase-21-8
// 写経レベル: コア ── 分岐の行の見せ方と、一覧に無い呼び出し先の印(検証のエラーと同じ条件)。
"use client";

// Phase-21-8:追記 ── react.useEffect, react.useRef, @/features/detailed-design/components/tableStyles.BADGE, @/features/detailed-design/logicOps.logicKey
import { useEffect, useId, useRef } from "react";
import { Paragraph, Text, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { ProcedureModel, ProcedureStep } from "@/features/detailed-design/api/types";
import {
  BADGE,
  CELL,
  HEAD,
  INPUT,
  MONO,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import { logicKey } from "@/features/detailed-design/logicOps";
import {
  addBranch,
  addStep,
  isExternalActor,
  numberSteps,
  removeStep,
  stepId,
  updateProcedure,
  updateStep,
} from "@/features/detailed-design/procedureOps";

// 呼び出し元・呼び出し先の入力の候補に出す外部の役者(自由に書いてもよい)
const ACTORS = ["利用者", "スケジューラ"];

// 段階5の、1つの処理の手順の表(No / 呼び出し元 → 呼び出し先 / 関数 / 渡すデータ / 処理内容 / 結果 /
// DB 操作 / 分岐・例外)と、選定理由・注記。編集した内容は onChange で呼び出し元(ProcedurePanel)へ返し、
// 保存は呼び出し元が行う。番号は並び順から導くので、行の追加・削除で振り直される。呼び出し先は段階4の
// モジュール一覧のパスを候補に出し、一覧に無いパスには印を出す(関与表の列の鍵のため。検証のエラーと
// 同じ。Phase 20)。分岐の行は、条件(処理内容の欄)と結果(分岐・例外の欄)だけを書く。
// Phase-21-8:追記
// 段階6に詳細がある手順(呼び出し先と関数が 06 の項目と一致する行)は、処理内容の下に「詳細 L-02 ↓」の
// バッジを出し、押すと段階6のその関数へ移る。段階6から移ってきた手順の行は強調して見える位置へ送る
// (Phase 21)。
// ── ここから Phase-20-6 の作成分 ──
export function ProcedureStepTable({
  model,
  functionId,
  modulePaths,
  disabled,
  onChange,
  // Phase-21-8:追記
  detailIds,
  onDetailPress,
  highlightedStep = null,
}: {
  model: ProcedureModel;
  functionId: string;
  modulePaths: string[]; // 段階4(承認済み)のモジュール一覧のパス
  disabled: boolean;
  onChange: (model: ProcedureModel) => void;
  // Phase-21-8:追記
  detailIds?: Map<string, string>; // 段階6の関数の鍵 → L-ID(logicOps の logicIdsByKey)
  onDetailPress?: (key: string) => void;
  highlightedStep?: string | null; // 強調する手順ID(段階6のバッジから移ってきたとき)
}) {
  const listId = useId();
  // Phase-21-8:追記
  const rows = useRef(new Map<string, HTMLTableRowElement>());

  useEffect(() => {
    if (highlightedStep) rows.current.get(highlightedStep)?.scrollIntoView({ block: "center" });
  }, [highlightedStep]);
  // ── ここから Phase-20-6 の作成分 ──

  const procedure = model.procedures.find((p) => p.function_id === functionId);
  if (!procedure) return null;
  const numbers = numberSteps(procedure.steps);
  const known = new Set(modulePaths);

  const field = (
    index: number,
    name: keyof Omit<ProcedureStep, "is_branch">,
    label: string,
    options: { mono?: boolean; list?: boolean; multiline?: boolean } = {},
  ) => {
    const step = procedure.steps[index];
    const common = {
      style: { ...INPUT, ...(options.mono ? MONO : {}) },
      "aria-label": `${stepId(functionId, numbers[index])} の${label}`,
      value: step[name],
      disabled,
    };
    const change = (value: string) =>
      onChange(updateStep(model, functionId, index, { [name]: value }));
    return options.multiline ? (
      <textarea
        {...common}
        style={{ ...common.style, minHeight: 40, resize: "vertical" }}
        onChange={(e) => change(e.target.value)}
      />
    ) : (
      <input
        {...common}
        list={options.list ? listId : undefined}
        onChange={(e) => change(e.target.value)}
      />
    );
  };

  return (
    <YStack gap="$2">
      <datalist id={listId}>
        {[...modulePaths, ...ACTORS].map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--color)" }}>
        <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>選定理由</span>
        <input
          style={INPUT}
          aria-label={`${functionId} の選定理由`}
          value={procedure.reason}
          disabled={disabled}
          onChange={(e) => onChange(updateProcedure(model, functionId, { reason: e.target.value }))}
        />
      </label>
      {procedure.steps.length === 0 ? (
        <Text color="$color11">
          手順はまだありません。下書きを生成するか、手順を足してください。
        </Text>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={HEAD}>No</th>
                <th style={HEAD}>呼び出し元 → 呼び出し先</th>
                <th style={HEAD}>関数</th>
                <th style={HEAD}>渡すデータ</th>
                <th style={HEAD}>処理内容</th>
                <th style={HEAD}>結果</th>
                <th style={HEAD}>DB 操作</th>
                <th style={HEAD}>分岐・例外</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {procedure.steps.map((step, index) => {
                const id = stepId(functionId, numbers[index]);
                const callee = step.callee.trim();
                // 空の呼び出し先・一覧に無いパスは検証のエラー(EMPTY_CALLEE・UNKNOWN_CALLEE)と同じ
                const unknown =
                  !step.is_branch &&
                  (callee === "" || (!isExternalActor(callee) && !known.has(callee)));
                // Phase-21-8:追記
                const key = logicKey(callee, step.call);
                const detail = step.is_branch ? undefined : detailIds?.get(key);
                const background =
                  id === highlightedStep
                    ? "var(--yellow4)"
                    : step.is_branch
                      ? "var(--color2)"
                      : undefined;
                // ── ここから Phase-20-6 の作成分 ──
                return (
                  // 行は位置で扱う(番号は並び順から導くので、行に固有の鍵が無い)
                  // Phase-21-8：更新(行の参照・強調の印・背景を足す)
                  // <tr key={index} style={step.is_branch ? { background: "var(--color2)" } : undefined}>
                  // ↓↓
                  <tr
                    key={index}
                    ref={(el) => {
                      if (el) rows.current.set(id, el);
                      else rows.current.delete(id);
                    }}
                    aria-current={id === highlightedStep ? "true" : undefined}
                    style={background ? { background } : undefined}
                  >
                    <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{numbers[index]}</td>
                    {step.is_branch ? (
                      <>
                        <td style={{ ...CELL, color: "var(--color11)", fontSize: 12 }} colSpan={3}>
                          分岐({numbers[index].replace(/[a-z]+$/, "")} の手順から)
                        </td>
                        <td style={{ ...CELL, minWidth: 220 }}>
                          {field(index, "action", "条件", { multiline: true })}
                        </td>
                        <td style={CELL} colSpan={2} />
                        <td style={{ ...CELL, minWidth: 180 }}>
                          {field(index, "branch", "分岐の結果")}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...CELL, minWidth: 260 }}>
                          {field(index, "caller", "呼び出し元", { mono: true, list: true })}
                          <div style={{ fontSize: 11, color: "var(--color11)" }}>↓</div>
                          {field(index, "callee", "呼び出し先", { mono: true, list: true })}
                          {unknown ? (
                            <div style={{ fontSize: 11, color: "var(--red10)" }}>
                              {callee ? "モジュール一覧に無いパスです" : "呼び出し先が空です"}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ ...CELL, minWidth: 160 }}>
                          {field(index, "call", "関数", { mono: true })}
                        </td>
                        <td style={{ ...CELL, minWidth: 130 }}>{field(index, "data", "渡すデータ")}</td>
                        <td style={{ ...CELL, minWidth: 220 }}>
                          {field(index, "action", "処理内容", { multiline: true })}
                          {/* Phase-21-8:追記 */}
                          {detail ? (
                            <button
                              type="button"
                              style={{ ...BADGE, cursor: "pointer", marginTop: 2 }}
                              aria-label={`${id} の詳細 ${detail} へ移る`}
                              onClick={() => onDetailPress?.(key)}
                            >
                              詳細 {detail} ↓
                            </button>
                          ) : null}
                        </td>
                        <td style={{ ...CELL, minWidth: 120 }}>{field(index, "result", "結果")}</td>
                        <td style={{ ...CELL, minWidth: 120 }}>
                          {field(index, "db", "DB 操作", { mono: true })}
                        </td>
                        <td style={{ ...CELL, minWidth: 140 }}>
                          {field(index, "branch", "分岐・例外")}
                        </td>
                      </>
                    )}
                    <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                      {step.is_branch ? null : (
                        <button
                          type="button"
                          aria-label={`${id} に分岐を足す`}
                          disabled={disabled}
                          onClick={() => onChange(addBranch(model, functionId, index))}
                        >
                          分岐
                        </button>
                      )}{" "}
                      <button
                        type="button"
                        aria-label={`${id} を削除`}
                        disabled={disabled}
                        onClick={() => onChange(removeStep(model, functionId, index))}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <YStack alignItems="flex-start">
        <StyledButton
          theme="gray"
          disabled={disabled}
          onPress={() => onChange(addStep(model, functionId))}
        >
          手順を足す
        </StyledButton>
      </YStack>
      <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--color)" }}>
        <span style={{ whiteSpace: "nowrap", fontSize: 13 }}>注記</span>
        <input
          style={INPUT}
          aria-label={`${functionId} の注記`}
          placeholder="トランザクションの範囲など"
          value={procedure.note}
          disabled={disabled}
          onChange={(e) => onChange(updateProcedure(model, functionId, { note: e.target.value }))}
        />
      </label>
      <Paragraph color="$color11" fontSize="$2">
        手順を消すと、その手順の分岐も消えます。番号は並び順から振り直します。
      </Paragraph>
    </YStack>
  );
}
