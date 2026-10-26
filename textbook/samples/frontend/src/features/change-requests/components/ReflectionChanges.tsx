// 作成：Phase-112-2
"use client";

import { useEffect, useRef } from "react";
import { Text, YStack } from "tamagui";
import type { AppliedReflectionRead, ReflectionChangeRead } from "@/features/change-requests/api/types";
import { reflectionGroups, restoreReasonLabel } from "@/features/change-requests/changeRequestOps";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";

const FOCUSED = { background: "var(--yellow3)" };

// 影響のタブの「反映で変わった所」(docs/external_design.md 2.14節「反映」)。文書への反映ごと(新しい順)に、
// 要件定義書・外部設計書の要素の前 → 後を、CR の対象・予測した要素・範囲の外・合意の形に戻した、に分けて出す。
// 比べたのはシステム(要素のキーで決定的に)で、LLM ではない。`focusKey`の要素は目立たせ、開いたときにそこへ移る
// (確認事項の「CR-n の反映で文が変わりました →」から来たとき)。
export function ReflectionChanges({
  reflections,
  focusKey = null,
}: {
  reflections: AppliedReflectionRead[];
  focusKey?: string | null;
}) {
  const focused = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    focused.current?.scrollIntoView({ block: "center" });
  }, [focusKey, reflections]);

  if (reflections.length === 0) return null;
  // 目立たせるのは、その要素が出る最新の反映だけ
  const focusAt = reflections.findIndex((r) => r.changes.some((c) => c.key === focusKey));

  return (
    <YStack gap="$3" aria-label="反映で変わった所">
      <Text fontWeight="600">反映で変わった所</Text>
      <Text color="$color11" fontSize="$2">
        反映の直前の版と反映で作った版を、要素ごとにシステムが比べた結果です(要件定義書・外部設計書の、合意の対象の要素)。
      </Text>
      {reflections.map((reflection, index) => (
        <YStack key={`${reflection.occurred_at}-${index}`} gap="$2">
          <Text fontSize="$3">
            {`${new Date(reflection.occurred_at).toLocaleString("ja-JP")} の反映(${reflection.documents.join("・")})`}
          </Text>
          {!reflection.recorded ? (
            <Text color="$color11">この反映は、前 → 後を残す前のものです(反映をやり直すと残ります)。</Text>
          ) : reflection.changes.length === 0 ? (
            <Text color="$color11">合意の対象の要素は変わりませんでした。</Text>
          ) : (
            reflectionGroups(reflection.changes).map((group) => (
              <YStack key={group.key} gap="$1">
                <Text fontSize="$3" color="$color11">{`${group.title}(${group.changes.length})`}</Text>
                {group.key === "restored" ? (
                  <RestoredTable changes={group.changes} />
                ) : (
                  <ChangeTable
                    changes={group.changes}
                    focusKey={index === focusAt ? focusKey : null}
                    focusedRef={focused}
                  />
                )}
              </YStack>
            ))
          )}
        </YStack>
      ))}
    </YStack>
  );
}

function ChangeTable({
  changes,
  focusKey,
  focusedRef,
}: {
  changes: ReflectionChangeRead[];
  focusKey: string | null;
  focusedRef: React.RefObject<HTMLTableRowElement | null>;
}) {
  return (
    <table style={TABLE}>
      <thead>
        <tr>
          <th style={HEAD}>要素</th>
          <th style={HEAD}>種類</th>
          <th style={HEAD}>欄</th>
          <th style={HEAD}>前</th>
          <th style={HEAD}>後</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => {
          const focused = change.key === focusKey;
          // 欄の無い変更(並びだけの違いなど)も1行は出す
          const fields = change.fields.length > 0 ? change.fields : [{ name: "", label: "─", before: "", after: "" }];
          return fields.map((field, i) => (
            <tr
              key={`${change.key}-${field.name}`}
              ref={focused && i === 0 ? focusedRef : undefined}
              data-focused={focused ? "true" : undefined}
              style={focused ? FOCUSED : undefined}
            >
              {i === 0 ? (
                <>
                  <td style={CELL} rowSpan={fields.length}>
                    {change.label}
                  </td>
                  <td style={{ ...CELL, whiteSpace: "nowrap" }} rowSpan={fields.length}>
                    {change.change_label}
                  </td>
                </>
              ) : null}
              <td style={{ ...CELL, whiteSpace: "nowrap" }}>{field.label}</td>
              <td style={{ ...CELL, whiteSpace: "pre-wrap" }}>{field.before}</td>
              <td style={{ ...CELL, whiteSpace: "pre-wrap" }}>{field.after}</td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
}

function RestoredTable({ changes }: { changes: ReflectionChangeRead[] }) {
  return (
    <table style={TABLE}>
      <thead>
        <tr>
          <th style={HEAD}>要素</th>
          <th style={HEAD}>キー</th>
          <th style={HEAD}>戻した理由</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((change) => (
          <tr key={change.key}>
            <td style={CELL}>{change.label}</td>
            <td style={{ ...CELL, ...MONO }}>{change.key}</td>
            <td style={CELL}>{restoreReasonLabel(change.restore_reason)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
