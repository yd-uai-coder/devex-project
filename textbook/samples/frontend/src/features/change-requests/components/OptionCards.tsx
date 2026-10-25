// 作成：Phase-107-2
"use client";

import { Paragraph, Text, XStack, YStack } from "tamagui";
import type { ChangeRequestOptionsRead } from "@/features/change-requests/api/types";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";

// 案のカード(名前・おすすめ・合意した案の印・変える要件と変更後の案・結果)。下書きの確かめでも使う
export function OptionCards({ options, chosen = null }: { options: ChangeRequestOptionsRead; chosen?: number | null }) {
  return (
    <>
      {options.items.map((option) => (
        <YStack
          key={option.number}
          gap="$1"
          padding="$3"
          borderWidth={1}
          borderColor={option.recommended ? "$green8" : "$borderColor"}
          borderRadius="$3"
          aria-label={option.label}
        >
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Text fontWeight="600">{`${option.label} ${option.name}`}</Text>
            {option.recommended ? <Text color="$green10">おすすめ</Text> : null}
            {chosen === option.number ? <Text color="$blue10">合意した案</Text> : null}
          </XStack>
          {option.targets.length > 0 ? (
            <table style={TABLE} aria-label={`${option.label}で変える要件`}>
              <thead>
                <tr>
                  <th style={HEAD}>要件</th>
                  <th style={HEAD}>変更の種類</th>
                  <th style={HEAD}>変更後の案</th>
                </tr>
              </thead>
              <tbody>
                {option.targets.map((t) => (
                  <tr key={t.requirement_id}>
                    <td style={{ ...CELL, ...MONO }}>{t.requirement_id}</td>
                    <td style={CELL}>{t.kind_label}</td>
                    <td style={CELL}>{t.kind === "delete" ? "(削除)" : t.proposed_text || "(内容を参照)"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Text fontSize="$3" color="$color11">
              変える要件はありません(新しい要件を足すだけ)。
            </Text>
          )}
          <Paragraph whiteSpace="pre-wrap">{`結果: ${option.outcome}`}</Paragraph>
        </YStack>
      ))}
    </>
  );
}
