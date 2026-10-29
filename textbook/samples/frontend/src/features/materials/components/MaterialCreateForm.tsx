// 作成：Phase-116-2｜更新：Phase-116(完了後の調整)
"use client";

import { useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { INPUT, OPTION } from "@/features/detailed-design/components/tableStyles";
import type { MaterialInput, MaterialKind } from "@/features/materials/api/types";
import {
  MATERIAL_BODY_MAX,
  MATERIAL_FILE_ACCEPT,
  MATERIAL_KIND_LABEL,
  materialFormBlocker,
  toMaterialInput,
  todayInput,
  type MaterialForm,
} from "@/features/materials/materialOps";

const FIELD = { display: "block", marginTop: 8, fontSize: 13 } as const;
const KINDS = Object.keys(MATERIAL_KIND_LABEL) as MaterialKind[];

// 資料を足すフォーム(docs/external_design.md 2.17節「資料」)。種類・題・日付と、本文の貼り付けか
// txt / md / pdf のファイル。本文の長さ・ファイルの大きさは送る前に止める(サーバーも同じ上限で断る)。
// 違いの取り出しはここではせず、足した後の資料のページで行う(LLM を呼ぶ前に束の鮮度を見せるため)
export function MaterialCreateForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (input: MaterialInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MaterialForm>(() => ({
    kind: "minutes",
    title: "",
    materialDate: todayInput(),
    source: "paste",
    body: "",
    file: null,
  }));
  const blocker = materialFormBlocker(form);
  const submit = () => {
    const input = toMaterialInput(form);
    if (input) onSubmit(input);
  };

  return (
    <YStack gap="$2">
      <XStack gap="$3" flexWrap="wrap">
        <label style={{ ...FIELD, flex: "1 1 140px" }}>
          種類
          <select
            style={INPUT}
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as MaterialKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind} style={OPTION}>
                {MATERIAL_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ ...FIELD, flex: "1 1 140px" }}>
          日付
          <input
            type="date"
            style={INPUT}
            value={form.materialDate}
            onChange={(e) => setForm({ ...form, materialDate: e.target.value })}
          />
        </label>
      </XStack>
      <label style={FIELD}>
        {/* Phase-116(完了後の調整)：更新 */}
        {/* 題 */}
        {/* ↓↓ */}
        タイトル
        <input style={INPUT} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>

      <XStack gap="$4" marginTop="$2" role="radiogroup" aria-label="本文の出どころ">
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="material-source"
            checked={form.source === "paste"}
            onChange={() => setForm({ ...form, source: "paste" })}
          />
          本文を貼り付ける
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="material-source"
            checked={form.source === "file"}
            onChange={() => setForm({ ...form, source: "file" })}
          />
          ファイルを選ぶ
        </label>
      </XStack>
      {form.source === "paste" ? (
        <label style={FIELD}>
          本文
          <textarea
            style={INPUT}
            rows={10}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
          <Text fontSize="$2" color="$color11">
            {`${form.body.trim().length} / ${MATERIAL_BODY_MAX} 文字`}
          </Text>
        </label>
      ) : (
        <label style={FIELD}>
          ファイル(txt・md・pdf、2MB まで。PDF は AI で本文を読みます)
          <input
            type="file"
            accept={MATERIAL_FILE_ACCEPT}
            style={{ display: "block", marginTop: 4 }}
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
          />
        </label>
      )}
      <Paragraph color="$color11" size="$2">
        足した後、資料のページで最新の合意済みの版と比べて、違いを取り出します。
      </Paragraph>

      {blocker ? <Text color="$color11">{blocker}</Text> : null}
      <XStack gap="$2">
        <Button size="$3" theme="green" disabled={submitting || blocker !== null} onPress={submit}>
          {submitting ? "足しています..." : "資料を足す"}
        </Button>
        <Button size="$3" chromeless onPress={onCancel}>
          やめる
        </Button>
      </XStack>
    </YStack>
  );
}
