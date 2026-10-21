// 作成：Phase-99(完了後の調整)
"use client";

import { useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { FunctionListModel, ProcedureModel } from "@/features/detailed-design/api/types";
import { CELL, HEAD, INPUT, MONO, OPTION, TABLE } from "@/features/detailed-design/components/tableStyles";
import {
  reassignProcedure,
  reassignTargets,
  removeProcedureAt,
  removeStrayProcedures,
  strayProcedures,
} from "@/features/detailed-design/procedureOps";

// 段階5 の、機能一覧に無い処理の手順(段階1 の作り直しで処理 ID が変わって残ったもの)の一覧。
// 「手順を書く処理」の選択には出ないので、ここで今の処理へ付け替えるか消す(段階8 の「計画に無い
// 手順書」と同じ形)。自動では消さない(人が決める)。変更は下書きに入り、保存して初めて反映される。
export function StrayProcedureTable({
  model,
  functionList,
  disabled,
  onChange,
}: {
  model: ProcedureModel;
  functionList: FunctionListModel;
  disabled: boolean;
  onChange: (model: ProcedureModel) => void;
}) {
  // 行ごとに選んだ付け替え先(手順の位置 → 処理 ID)
  const [choices, setChoices] = useState<Record<number, string>>({});
  const strays = strayProcedures(model, functionList);
  if (strays.length === 0) return null;
  const targets = reassignTargets(model, functionList);

  return (
    <YStack gap="$2" aria-label="機能一覧に無い処理の手順">
      <Text fontWeight="700" color="$orange10">
        {`機能一覧に無い処理の手順(${strays.length})`}
      </Text>
      <Paragraph color="$color11" fontSize="$2">
        段階1 の処理 ID が変わったため、どの処理とも合わない手順です。このままでは承認できません。活かす手順は今の処理へ付け替え(中身はそのまま)、要らない手順は消してください。付け替えた後は、その処理のタブで手順を作り直すと、呼び出し先も今のモジュール一覧にそろいます。変更は保存して反映されます。
      </Paragraph>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label="機能一覧に無い処理の手順の一覧">
          <thead>
            <tr>
              {["作ったときの処理", "手順数", "付け替え先", ""].map((head, i) => (
                <th key={i} style={HEAD}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {strays.map((stray) => {
              const chosen = choices[stray.index] ?? "";
              const target = targets.find((fn) => fn.id === chosen);
              return (
                <tr key={stray.index}>
                  <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{stray.functionId}</td>
                  <td style={CELL}>{`${stray.stepCount} 件`}</td>
                  <td style={{ ...CELL, minWidth: 240 }}>
                    <select
                      style={INPUT}
                      aria-label={`${stray.functionId} の付け替え先`}
                      value={chosen}
                      disabled={disabled || targets.length === 0}
                      onChange={(e) => setChoices((current) => ({ ...current, [stray.index]: e.target.value }))}
                    >
                      <option value="" style={OPTION}>
                        {targets.length === 0 ? "(手順の無い処理がありません)" : "(選ぶ)"}
                      </option>
                      {targets.map((fn) => (
                        <option key={fn.id} value={fn.id} style={OPTION}>
                          {`${fn.id} ${fn.name}`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={CELL}>
                    <XStack gap="$2">
                      <StyledButton
                        size="$2"
                        disabled={disabled || target === undefined}
                        aria-label={`${stray.functionId} を付け替える`}
                        onPress={() => {
                          if (target === undefined) return;
                          setChoices({});
                          onChange(reassignProcedure(model, functionList, stray.index, target.id));
                        }}
                      >
                        付け替える
                      </StyledButton>
                      <StyledButton
                        size="$2"
                        theme="red"
                        disabled={disabled}
                        aria-label={`${stray.functionId} の手順を消す`}
                        onPress={() => {
                          setChoices({});
                          onChange(removeProcedureAt(model, stray.index));
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
            onChange(removeStrayProcedures(model, functionList));
          }}
        >
          機能一覧に無い手順をすべて消す
        </StyledButton>
      </YStack>
    </YStack>
  );
}
