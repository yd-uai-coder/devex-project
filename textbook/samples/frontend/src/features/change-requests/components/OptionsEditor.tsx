// 作成：Phase-107-2
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestTargetRead, TargetKind } from "@/features/change-requests/api/types";
import {
  OPTIONS_MAX,
  TARGET_KIND_OPTIONS,
  addOption,
  optionLabel,
  optionsProblems,
  removeOption,
  setTargetKind,
  setTargetProposal,
  toggleOptionTarget,
  updateOption,
  type OptionsForm,
} from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, INPUT, MONO, OPTION, TABLE } from "@/features/detailed-design/components/tableStyles";

const LABEL = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 2 } as const;

// 選択肢(案)の編集欄。案ごとに名前・この案で変える要件(CR の対象から選び、種類と変更後の案を直せる)・
// 結果(手間・影響・トレードオフ)を書き、おすすめの案と理由を選ぶ。案は0件か2〜3件で、全部消すと
// 「案なし」で保存する。新しい要件を足す CR は、変える要件の無い案も持てる
export function OptionsEditor({
  initial,
  crTargets,
  addsRequirement,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: OptionsForm;
  crTargets: ChangeRequestTargetRead[];
  addsRequirement: boolean;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (form: OptionsForm) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<OptionsForm>(initial);
  const [showProblems, setShowProblems] = useState(false);
  const problems = optionsProblems(form, crTargets, addsRequirement);

  const submit = () => {
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    onSubmit(form);
  };

  return (
    <YStack gap="$3" aria-label="案の編集">
      {form.items.length === 0 ? <Text color="$color11">案はありません(保存すると、案の無い CR になります)。</Text> : null}
      {form.items.map((option, i) => {
        const label = optionLabel(i + 1);
        return (
          <YStack
            key={i}
            gap="$2"
            padding="$3"
            borderWidth={1}
            borderColor="$borderColor"
            borderRadius="$3"
            aria-label={`${label}の編集`}
          >
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="600">{label}</Text>
              <Button size="$2" chromeless onPress={() => setForm(removeOption(form, i))}>
                {`${label}を消す`}
              </Button>
            </XStack>
            <label style={LABEL}>
              名前
              <input
                style={INPUT}
                value={option.name}
                onChange={(e) => setForm(updateOption(form, i, { name: e.target.value }))}
              />
            </label>
            <Text fontSize={13} fontWeight="600">
              この案で変える要件
            </Text>
            <table style={TABLE} aria-label={`${label}で変える要件`}>
              <thead>
                <tr>
                  <th style={HEAD}>変える</th>
                  <th style={HEAD}>要件</th>
                  <th style={HEAD}>変更の種類</th>
                  <th style={HEAD}>変更後の案</th>
                </tr>
              </thead>
              <tbody>
                {crTargets.map((target) => {
                  const picked = option.targets.find((t) => t.requirement_id === target.requirement_id);
                  return (
                    <tr key={target.requirement_id}>
                      <td style={CELL}>
                        <input
                          type="checkbox"
                          aria-label={`${label}で ${target.requirement_id} を変える`}
                          checked={picked !== undefined}
                          onChange={(e) =>
                            setForm(updateOption(form, i, toggleOptionTarget(option, target, e.target.checked)))
                          }
                        />
                      </td>
                      <td style={{ ...CELL, ...MONO }}>{target.requirement_id}</td>
                      <td style={CELL}>
                        {picked ? (
                          <select
                            style={INPUT}
                            aria-label={`${label}の ${target.requirement_id} の変更の種類`}
                            value={picked.kind}
                            onChange={(e) =>
                              setForm(
                                updateOption(form, i, {
                                  targets: setTargetKind(
                                    option.targets,
                                    target.requirement_id,
                                    e.target.value as TargetKind,
                                  ),
                                }),
                              )
                            }
                          >
                            {TARGET_KIND_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value} style={OPTION}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </td>
                      <td style={CELL}>
                        {picked === undefined ? null : picked.kind === "delete" ? (
                          <Text color="$color11">(削除)</Text>
                        ) : (
                          <textarea
                            style={INPUT}
                            rows={2}
                            aria-label={`${label}の ${target.requirement_id} の変更後の案`}
                            value={picked.proposed_text}
                            onChange={(e) =>
                              setForm(
                                updateOption(form, i, {
                                  targets: setTargetProposal(option.targets, target.requirement_id, e.target.value),
                                }),
                              )
                            }
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <label style={LABEL}>
              結果(手間・影響・トレードオフ)
              <textarea
                style={INPUT}
                rows={3}
                value={option.outcome}
                onChange={(e) => setForm(updateOption(form, i, { outcome: e.target.value }))}
              />
            </label>
          </YStack>
        );
      })}
      {form.items.length < OPTIONS_MAX ? (
        <XStack>
          <Button size="$2" onPress={() => setForm(addOption(form))}>
            {form.items.length === 0 ? "案を2つ足す" : "案を足す"}
          </Button>
        </XStack>
      ) : null}

      {form.items.length > 0 ? (
        <YStack gap="$2">
          <label style={LABEL}>
            おすすめの案
            <select
              style={{ ...INPUT, width: "auto" }}
              value={form.recommended ?? ""}
              onChange={(e) => setForm({ ...form, recommended: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="" style={OPTION}>
                おすすめなし
              </option>
              {form.items.map((option, i) => (
                <option key={i} value={i + 1} style={OPTION}>
                  {`${optionLabel(i + 1)} ${option.name}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label style={LABEL}>
            おすすめの理由
            <textarea
              style={INPUT}
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </label>
        </YStack>
      ) : null}

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
