"use client";
// 作成：Phase-88-3

import { useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { nowLocalInput } from "@/features/change-requests/changeRequestOps";
import type { DesignStageRead } from "@/features/detailed-design/api/types";
import { CELL, HEAD, INPUT, TABLE } from "@/features/detailed-design/components/tableStyles";
import type { BaselineCreate } from "@/features/baselines/api/types";
import {
  applySelection,
  createBlocker,
  stagePreview,
  toCreateBody,
  type BaselineForm,
} from "@/features/baselines/baselineOps";

const FIELD = { display: "block", marginTop: 8, fontSize: 13 } as const;
type NoteField = "counterpart" | "memo" | "reason";

// 合意済みの版(束)の作成のフォーム。検証済みでまだ束に入れていない CR を選ぶと、手で直していない
// 合意の記録の欄を、その CR の記録で埋める。今の段階の状態から、束に入る段階・入らない段階を示す
// (未承認の段階は「入っていない」と記録される)。段階の生成中は作れない
export function BaselineCreateForm({
  candidates,
  stages,
  submitting,
  onSubmit,
  onCancel,
}: {
  candidates: ChangeRequestSummaryRead[];
  stages: DesignStageRead[] | null;
  submitting: boolean;
  onSubmit: (body: BaselineCreate) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<BaselineForm>(() => ({
    agreedAt: nowLocalInput(),
    counterpart: "",
    memo: "",
    reason: "",
    changeRequestNumbers: [],
  }));
  const [touched, setTouched] = useState<Set<NoteField>>(() => new Set());
  const blocker = createBlocker(stages, form);

  const toggle = (number: number) => {
    const numbers = form.changeRequestNumbers.includes(number)
      ? form.changeRequestNumbers.filter((n) => n !== number)
      : [...form.changeRequestNumbers, number];
    setForm(applySelection(form, numbers, candidates, touched));
  };
  const edit = (field: NoteField, value: string) => {
    setTouched(new Set(touched).add(field));
    setForm({ ...form, [field]: value });
  };
  const submit = () => {
    const body = toCreateBody(form);
    if (body && !blocker) onSubmit(body);
  };

  return (
    <YStack gap="$3">
      <YStack gap="$1">
        <Text fontWeight="bold">入れる変更要求(検証済みで、まだどの版にも入れていないもの)</Text>
        {candidates.length === 0 ? (
          <Text color="$color11">入れられる変更要求はありません(変更要求を入れずに作ることもできます)。</Text>
        ) : (
          candidates.map((cr) => (
            <label key={cr.number} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={form.changeRequestNumbers.includes(cr.number)}
                onChange={() => toggle(cr.number)}
              />
              {cr.label} {cr.title}
            </label>
          ))
        )}
      </YStack>

      <YStack>
        <Text fontWeight="bold">合意の記録</Text>
        <Paragraph color="$color11" size="$2">
          変更要求を選ぶと、まだ直していない欄に、その変更要求の合意の記録が入ります。
        </Paragraph>
        <label style={FIELD}>
          相手(名前と役割。空でもよい)
          <input style={INPUT} value={form.counterpart} onChange={(e) => edit("counterpart", e.target.value)} />
        </label>
        <label style={FIELD}>
          合意の日時
          <input
            type="datetime-local"
            style={INPUT}
            value={form.agreedAt}
            onChange={(e) => setForm({ ...form, agreedAt: e.target.value })}
          />
        </label>
        <label style={FIELD}>
          打ち合わせのメモ(任意)
          <textarea style={INPUT} rows={3} value={form.memo} onChange={(e) => edit("memo", e.target.value)} />
        </label>
        <label style={FIELD}>
          理由
          <textarea style={INPUT} rows={3} value={form.reason} onChange={(e) => edit("reason", e.target.value)} />
        </label>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="bold">束に写すもの</Text>
        <Paragraph color="$color11" size="$2">
          表示中の要件定義書・外部設計書・テスト仕様書(あれば)と、承認済みの段階を写します。承認したことの無い段階は「入っていない」と記録します。
        </Paragraph>
        {stages === null ? (
          <Text color="$color11">段階の状態を読み込み中...</Text>
        ) : (
          <table style={TABLE} aria-label="束に入る段階">
            <thead>
              <tr>
                <th style={HEAD}>段階</th>
                <th style={HEAD}>今の状態</th>
                <th style={HEAD}>束に</th>
              </tr>
            </thead>
            <tbody>
              {stagePreview(stages).map((s) => (
                <tr key={s.stage}>
                  <td style={CELL}>
                    段階{s.stage} {s.title}
                  </td>
                  <td style={CELL}>{s.state}</td>
                  <td style={CELL}>{s.included ? "入る(承認の写し)" : "入らない"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </YStack>

      {blocker ? <Text color="$color11">{blocker}</Text> : null}
      <XStack gap="$2">
        <Button size="$3" theme="green" disabled={submitting || blocker !== null} onPress={submit}>
          {submitting ? "作成中..." : "合意済みの版を作る"}
        </Button>
        <Button size="$3" chromeless onPress={onCancel}>
          やめる
        </Button>
      </XStack>
    </YStack>
  );
}
