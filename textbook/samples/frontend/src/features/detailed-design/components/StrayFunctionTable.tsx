// 作成：Phase-109-1
"use client";

import { useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import type { FunctionRow } from "@/features/detailed-design/api/types";
import { CELL, HEAD, INPUT, MONO, OPTION, TABLE } from "@/features/detailed-design/components/tableStyles";

// 一覧の1行。key は行を指す値(段階ごとに決める)、detail は行の中身の要約、targets は付け替え先に
// 選べる処理。
export type StrayRow = { key: string; functionId: string; detail: string; targets: FunctionRow[] };

// 段階2・3・7 の、機能一覧に無い処理を参照している行(段階1 の作り直しで処理 ID が変わって残った
// もの)の一覧。段階5 の StrayProcedureTable と同じ形で、今の処理へ付け替えるか消す(外す)。
// 一覧の作り方と操作は段階ごとの純粋関数が持ち、この部品は表と選択だけを持つ。自動では消さない
// (人が決める)。変更は下書きに入り、保存して初めて反映される。
export function StrayFunctionTable({
  title,
  description,
  detailHead,
  rows,
  removeLabel,
  removeAllLabel,
  disabled,
  onReassign,
  onRemove,
  onRemoveAll,
}: {
  title: string;
  description: string;
  detailHead: string;
  rows: StrayRow[];
  // 1行ずつの操作の名前(「消す」か「外す」)
  removeLabel: string;
  removeAllLabel: string;
  disabled: boolean;
  onReassign: (key: string, functionId: string) => void;
  onRemove: (key: string) => void;
  onRemoveAll: () => void;
}) {
  // 行ごとに選んだ付け替え先(行の key → 処理 ID)
  const [choices, setChoices] = useState<Record<string, string>>({});
  if (rows.length === 0) return null;

  return (
    <YStack gap="$2" aria-label={title}>
      <Text fontWeight="700" color="$orange10">
        {`${title}(${rows.length})`}
      </Text>
      <Paragraph color="$color11" fontSize="$2">
        {description}
      </Paragraph>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label={`${title}の一覧`}>
          <thead>
            <tr>
              {["作ったときの処理", detailHead, "付け替え先", ""].map((head, i) => (
                <th key={i} style={HEAD}>
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const chosen = choices[row.key] ?? "";
              const target = row.targets.find((fn) => fn.id === chosen);
              const name = `${row.functionId}(${row.detail})`;
              return (
                <tr key={row.key}>
                  <td style={{ ...CELL, ...MONO, whiteSpace: "nowrap" }}>{row.functionId}</td>
                  <td style={CELL}>{row.detail}</td>
                  <td style={{ ...CELL, minWidth: 240 }}>
                    <select
                      style={INPUT}
                      aria-label={`${name} の付け替え先`}
                      value={chosen}
                      disabled={disabled || row.targets.length === 0}
                      onChange={(e) => setChoices((current) => ({ ...current, [row.key]: e.target.value }))}
                    >
                      <option value="" style={OPTION}>
                        {row.targets.length === 0 ? "(付け替えられる処理がありません)" : "(選ぶ)"}
                      </option>
                      {row.targets.map((fn) => (
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
                        aria-label={`${name} を付け替える`}
                        onPress={() => {
                          if (target === undefined) return;
                          setChoices({});
                          onReassign(row.key, target.id);
                        }}
                      >
                        付け替える
                      </StyledButton>
                      <StyledButton
                        size="$2"
                        theme="red"
                        disabled={disabled}
                        aria-label={`${name} を${removeLabel}`}
                        onPress={() => {
                          setChoices({});
                          onRemove(row.key);
                        }}
                      >
                        {removeLabel}
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
            onRemoveAll();
          }}
        >
          {removeAllLabel}
        </StyledButton>
      </YStack>
    </YStack>
  );
}
