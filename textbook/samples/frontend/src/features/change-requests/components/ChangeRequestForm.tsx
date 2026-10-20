// 作成：Phase-87-2｜更新：Phase-88-2,88(完了後の調整)
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
// Phase-88-2：更新
// import type { BaselineRequirementRead, BaselineSummaryRead } from "@/features/change-requests/api/types";
// ↓↓
// Phase-88(完了後の調整)：更新
// import type { BaselineRequirementRead, BaselineSummaryRead } from "@/features/baselines/api/types";
// ↓↓
import type { BaselineRequirementRead } from "@/features/baselines/api/types";
import {
  BACKGROUND_SOURCE_OPTIONS,
  TARGET_KIND_OPTIONS,
  addTarget,
  formProblems,
  removeTarget,
  setTargetKind,
  setTargetProposal,
  type ChangeRequestForm as FormState,
} from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, INPUT, MONO, OPTION, TABLE } from "@/features/detailed-design/components/tableStyles";

const LABEL = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 2 } as const;

// CR の作成・編集のフォーム。対象の要件は基準の合意済みの版(束)の要件から選び、要件ごとに変更の種類
// (内容の変更 / 削除)と、任意の変更後の案を入れる(削除には案を書けないので欄を出さない)。
// Phase-88(完了後の調整)：更新
// // `baselines` を渡すと基準の束を選べる(作成のときだけ。編集では基準の束を変えない)。
// ↓↓
// 基準の束はこのフォームでは選ばない(作成は合意済みの版の中身から移るので固定。編集では変えない)。
export function ChangeRequestForm({
  initial,
  // Phase-88(完了後の調整)：削除
  // baselines,
  requirements,
  // Phase-88(完了後の調整)：削除
  // onBaselineChange,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  // Phase-88(完了後の調整)：更新
  // baselines?: BaselineSummaryRead[];
  // // 選んでいる束の要件(読み込み中は null)
  // ↓↓
  // 基準の束の要件(読み込み中は null)
  requirements: BaselineRequirementRead[] | null;
  // Phase-88(完了後の調整)：削除
  // onBaselineChange?: (baselineNumber: number) => void;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [picked, setPicked] = useState("");
  const [showProblems, setShowProblems] = useState(false);
  const problems = formProblems(form);
  const textOf = (id: string) => requirements?.find((r) => r.id === id)?.text ?? "";
  const choices = (requirements ?? []).filter((r) => !form.targets.some((t) => t.requirement_id === r.id));
  const update = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));

  const submit = () => {
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    onSubmit(form);
  };

  return (
    <YStack gap="$3" aria-label="変更要求のフォーム">
      {/* Phase-88(完了後の調整)：削除
      {baselines ? (
        <label>
          <span style={LABEL}>基準の合意済みの版</span>
          <select
            style={{ ...INPUT, width: "auto" }}
            value={form.baseline_number ?? ""}
            onChange={(e) => {
              const number = Number(e.target.value);
              update({ baseline_number: number, targets: [] });
              onBaselineChange?.(number);
            }}
          >
            {baselines.map((b) => (
              <option key={b.number} value={b.number} style={OPTION}>
                {`${b.label}(${new Date(b.agreed_at).toLocaleDateString("ja-JP")} 合意)`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      */}
      <label>
        <span style={LABEL}>タイトル</span>
        <input style={INPUT} value={form.title} maxLength={200} onChange={(e) => update({ title: e.target.value })} />
      </label>
      <label>
        <span style={LABEL}>内容</span>
        <textarea
          style={INPUT}
          rows={4}
          value={form.content}
          onChange={(e) => update({ content: e.target.value })}
        />
      </label>

      <XStack gap="$3" flexWrap="wrap">
        <label>
          <span style={LABEL}>背景の出どころ</span>
          <select
            style={{ ...INPUT, width: "auto" }}
            value={form.background_source}
            onChange={(e) => update({ background_source: e.target.value as FormState["background_source"] })}
          >
            {BACKGROUND_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={OPTION}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span style={LABEL}>日付(任意)</span>
          <input
            type="date"
            style={{ ...INPUT, width: "auto" }}
            value={form.background_date}
            onChange={(e) => update({ background_date: e.target.value })}
          />
        </label>
      </XStack>
      <label>
        <span style={LABEL}>背景のメモ(任意)</span>
        <textarea
          style={INPUT}
          rows={2}
          value={form.background_memo}
          onChange={(e) => update({ background_memo: e.target.value })}
        />
      </label>

      <YStack gap="$2">
        <Text fontWeight="600">対象の要件</Text>
        {requirements === null ? <Text color="$color11">要件を読み込み中...</Text> : null}
        {form.targets.length > 0 ? (
          <table style={TABLE} aria-label="対象の要件">
            <thead>
              <tr>
                <th style={HEAD}>要件</th>
                <th style={HEAD}>合意済みの文</th>
                <th style={HEAD}>変更の種類</th>
                <th style={HEAD}>変更後の案(任意)</th>
                <th style={HEAD} />
              </tr>
            </thead>
            <tbody>
              {form.targets.map((t) => (
                <tr key={t.requirement_id}>
                  <td style={{ ...CELL, ...MONO }}>{t.requirement_id}</td>
                  <td style={CELL}>{textOf(t.requirement_id)}</td>
                  <td style={CELL}>
                    <select
                      style={INPUT}
                      aria-label={`${t.requirement_id} の変更の種類`}
                      value={t.kind}
                      onChange={(e) =>
                        update({
                          targets: setTargetKind(form.targets, t.requirement_id, e.target.value as typeof t.kind),
                        })
                      }
                    >
                      {TARGET_KIND_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value} style={OPTION}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={CELL}>
                    {t.kind === "delete" ? (
                      <Text color="$color11">(削除)</Text>
                    ) : (
                      <textarea
                        style={INPUT}
                        rows={2}
                        aria-label={`${t.requirement_id} の変更後の案`}
                        value={t.proposed_text}
                        onChange={(e) =>
                          update({ targets: setTargetProposal(form.targets, t.requirement_id, e.target.value) })
                        }
                      />
                    )}
                  </td>
                  <td style={CELL}>
                    <Button
                      size="$2"
                      chromeless
                      onPress={() => update({ targets: removeTarget(form.targets, t.requirement_id) })}
                    >
                      外す
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {choices.length > 0 ? (
          <XStack gap="$2" alignItems="center">
            <select
              style={{ ...INPUT, width: "auto", maxWidth: 480 }}
              aria-label="足す要件"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="" style={OPTION}>
                要件を選ぶ
              </option>
              {choices.map((r) => (
                <option key={r.id} value={r.id} style={OPTION}>
                  {`${r.id} ${r.text}`.slice(0, 80)}
                </option>
              ))}
            </select>
            <Button
              size="$2"
              disabled={!picked}
              onPress={() => {
                update({ targets: addTarget(form.targets, picked) });
                setPicked("");
              }}
            >
              対象に足す
            </Button>
          </XStack>
        ) : null}
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={form.adds_requirement}
            onChange={(e) => update({ adds_requirement: e.target.checked })}
          />{" "}
          新しい要件を足す(ID の無い要件。影響の予測には入りません)
        </label>
      </YStack>

      {showProblems && problems.length > 0 ? (
        <YStack role="alert">
          {problems.map((p) => (
            <Text key={p} color="$red10">
              {p}
            </Text>
          ))}
        </YStack>
      ) : null}
      <XStack gap="$2">
        <Button size="$3" theme="green" disabled={submitting} onPress={submit}>
          {submitLabel}
        </Button>
        <Button size="$3" chromeless disabled={submitting} onPress={onCancel}>
          キャンセル
        </Button>
      </XStack>
    </YStack>
  );
}
