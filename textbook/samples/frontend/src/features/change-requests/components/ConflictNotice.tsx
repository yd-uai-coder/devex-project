// 作成：Phase-112-4
"use client";

import Link from "next/link";
import { Button, Paragraph, Text, YStack } from "tamagui";
import type { ChangeRequestRead } from "@/features/change-requests/api/types";
import { useChangeRequestsStore } from "@/features/change-requests/change-requests-store";
import { changeRequestHref, uncheckedConflicts } from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";

// 重なる CR の競合の知らせ(docs/external_design.md 2.14節「競合」)。CR の案は基準の束の文をもとに書くので、
// 束の後にほかの CR の反映で対象の要件が変わっていると、この CR の反映で先の変更を上書きしうる。対象の要件ごとに
// 先に変えた CR・束の文・今の文を出し、「今の文と見比べて確かめた」の印を付けさせる(文書への反映は印が要る)。
// 確かめた後にさらに変わったら、印は外れてまた出る。競合が無ければ何も出さない。
export function ConflictNotice({ projectId, cr }: { projectId: string; cr: ChangeRequestRead }) {
  const acting = useChangeRequestsStore((s) => s.acting);
  const checkConflicts = useChangeRequestsStore((s) => s.checkConflicts);

  if (cr.conflicts.length === 0) return null;
  const pending = uncheckedConflicts(cr).length > 0;

  return (
    <YStack
      gap="$2"
      padding="$3"
      borderWidth={1}
      borderColor={pending ? "$orange8" : "$borderColor"}
      borderRadius="$4"
      aria-label="先にほかの CR が変えた対象の要件"
    >
      <Text fontWeight="600" color={pending ? "$orange11" : undefined}>
        先にほかの CR が変えた対象の要件
      </Text>
      <Paragraph color="$color11" fontSize="$3">
        {`この CR の案は、基準の束(${cr.baseline_label})の文をもとにしています。束の後に、次の要件がほかの CR の反映で変わりました。案が先の変更を消さないか、今の文と見比べてください。`}
        {pending ? "文書への反映は、見比べて確かめるまでできません。" : ""}
      </Paragraph>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={HEAD}>要件</th>
            <th style={HEAD}>先に変えた CR</th>
            <th style={HEAD}>{`束(${cr.baseline_label})の文`}</th>
            <th style={HEAD}>今の文</th>
            <th style={HEAD}>確かめ</th>
          </tr>
        </thead>
        <tbody>
          {cr.conflicts.map((conflict) => (
            <tr key={conflict.requirement_id}>
              <td style={{ ...CELL, ...MONO }}>{conflict.requirement_id}</td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                {conflict.by_numbers.map((n, i) => (
                  <Link
                    key={n}
                    href={changeRequestHref(projectId, n, { tab: "impact", focus: `req:${conflict.requirement_id}` })}
                    style={{ color: "var(--blue10)", marginRight: 6 }}
                  >
                    {conflict.by[i]}
                  </Link>
                ))}
              </td>
              <td style={{ ...CELL, whiteSpace: "pre-wrap" }}>{conflict.base_text}</td>
              <td style={{ ...CELL, whiteSpace: "pre-wrap" }}>{conflict.current_text ?? "(消えています)"}</td>
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{conflict.checked ? "確かめ済み" : "未確認"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending ? (
        <Button
          size="$3"
          alignSelf="flex-start"
          disabled={acting}
          onPress={() => void checkConflicts(projectId, cr.number)}
        >
          今の文と見比べて確かめた
        </Button>
      ) : null}
    </YStack>
  );
}
