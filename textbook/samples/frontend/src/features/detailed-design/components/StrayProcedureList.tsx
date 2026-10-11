// 作成：Phase-38(完了後の調整)
"use client";

import { useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { PlanModel, ProcedureDocModel } from "@/features/detailed-design/api/types";
import {
  CELL,
  HEAD,
  INPUT,
  MONO,
  OPTION,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import {
  reassignTargets,
  reassignUnit,
  removeStrayProcedures,
  removeUnitAt,
  strayProcedures,
} from "@/features/detailed-design/procedureDocOps";

// 計画と合わない手順書(文書の再生成や段階7の並べ替えで単位が変わって残ったもの)の一覧。
// 単位の一覧には出ないので、ここで今の単位へ付け替えるか消す。自動では消さない(人が決める)。
// 変更は下書きに入り、保存して初めて反映される。
export function StrayProcedureList({
  plan,
  doc,
  planLabel,
  disabled,
  onChange,
}: {
  plan: PlanModel;
  doc: ProcedureDocModel;
  planLabel: string;
  disabled: boolean;
  onChange: (doc: ProcedureDocModel) => void;
}) {
  // 行ごとに選んだ付け替え先(手順書の位置 → 単位の ID)
  const [choices, setChoices] = useState<Record<number, string>>({});
  const strays = strayProcedures(plan, doc);
  if (strays.length === 0) return null;

  return (
    <YStack gap="$2" aria-label="計画に無い手順書">
      <Text fontWeight="700" color="$orange10">
        {`${planLabel}に無い手順書(${strays.length})`}
      </Text>
      <Paragraph color="$color11" fontSize="$2">
        {`${planLabel}の単位が変わったため、どの単位とも合わない手順書です。このままでは承認できません。活かす手順書は今の単位へ付け替え(中身はそのまま。付け替えた単位の詳細で中身を確かめてください)、要らない手順書は消してください。変更は保存して反映されます。`}
      </Paragraph>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label="計画に無い手順書の一覧">
          <thead>
            <tr>
              {["作ったときの単位", "タスク", "ファイル", "付け替え先", ""].map((head, i) => (
                <th key={i} style={HEAD}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strays.map((stray) => {
              const targets = reassignTargets(plan, doc, stray);
              const chosen = choices[stray.index] ?? "";
              const target = targets.find((unit) => unit.id === chosen);
              return (
                <tr key={stray.index}>
                  <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{stray.unitId}</td>
                  <td style={CELL}>{stray.title || "—"}</td>
                  <td style={CELL}>{`${stray.fileCount} 件`}</td>
                  <td style={{ ...CELL, minWidth: 220 }}>
                    <select
                      style={INPUT}
                      aria-label={`${stray.unitId} の付け替え先`}
                      value={chosen}
                      disabled={disabled || targets.length === 0}
                      onChange={(e) =>
                        setChoices((current) => ({ ...current, [stray.index]: e.target.value }))
                      }
                    >
                      <option value="" style={OPTION}>
                        {targets.length === 0 ? "(手順書の無い単位がありません)" : "(選ぶ)"}
                      </option>
                      {targets.map((unit) => (
                        <option key={unit.id} value={unit.id} style={OPTION}>
                          {`${unit.id} ${unit.title}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={CELL}>
                    <XStack gap="$2">
                      <StyledButton
                        size="$2"
                        disabled={disabled || target === undefined}
                        aria-label={`${stray.unitId} を付け替える`}
                        onPress={() => {
                          if (target === undefined) return;
                          setChoices({});
                          onChange(reassignUnit(doc, stray.index, target));
                        }}
                      >
                        付け替える
                      </StyledButton>
                      <StyledButton
                        size="$2"
                        theme="red"
                        disabled={disabled}
                        aria-label={`${stray.unitId} を消す`}
                        onPress={() => {
                          setChoices({});
                          onChange(removeUnitAt(doc, stray.index));
                        }}
                      >
                        消す
                      </StyledButton>
                    </XStack>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <YStack alignItems="flex-start">
        <StyledButton
          theme="red"
          disabled={disabled}
          onPress={() => {
            setChoices({});
            onChange(removeStrayProcedures(plan, doc));
          }}
        >
          {`${planLabel}に無い手順書をすべて消す`}
        </StyledButton>
      </YStack>
    </YStack>
  );
}
