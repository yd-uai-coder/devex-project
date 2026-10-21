// 作成：Phase-98-1
"use client";

import { useState } from "react";
import { Button, Text, XStack, YStack } from "tamagui";
import type {
  ConfirmationItemRead,
  ConfirmationStatus,
  ConfirmationUpdate,
  Opportunity,
} from "@/features/confirmations/api/types";
import { KIND_LABEL, OPPORTUNITY_OPTIONS } from "@/features/confirmations/confirmationOps";
import { CELL, HEAD, INPUT, MONO, OPTION, TABLE } from "@/features/detailed-design/components/tableStyles";

const STATUS_COLOR: Record<ConfirmationStatus, string> = {
  unconfirmed: "var(--red10)",
  confirmed: "var(--green10)",
  rejected: "var(--color11)",
};

// 状態を変えるボタン(今の状態のボタンは出さない)
const STATUS_ACTIONS: { status: ConfirmationStatus; label: string }[] = [
  { status: "confirmed", label: "確認済みにする" },
  { status: "rejected", label: "却下" },
  { status: "unconfirmed", label: "未確認に戻す" },
];

// 確認事項の表。行ごとに決める機会・状態・メモを変える(変えたらすぐ onUpdate)。readOnly は一覧から
// 消えた項目(決めた記録)の表示で、操作を出さない。
export function ConfirmationTable({
  items,
  label,
  savingKey,
  readOnly = false,
  onUpdate,
}: {
  items: ConfirmationItemRead[];
  label: string;
  // 保存中の項目のキー(その間はすべての行の操作を止める)
  savingKey: string | null;
  readOnly?: boolean;
  onUpdate: (item: ConfirmationItemRead, body: ConfirmationUpdate) => void;
}) {
  const busy = savingKey !== null;
  return (
    <table style={TABLE} aria-label={label}>
      <thead>
        <tr>
          <th style={HEAD}>種類</th>
          <th style={HEAD}>項目</th>
          <th style={HEAD}>決める機会</th>
          <th style={HEAD}>状態</th>
          <th style={HEAD}>メモ</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.key}>
            <td style={{ ...CELL, whiteSpace: "nowrap" }}>{KIND_LABEL[item.kind]}</td>
            <td style={CELL}>
              {item.label}
              {item.refs.length > 0 ? (
                <span style={{ display: "block", fontSize: 12, color: "var(--color11)" }}>
                  関わる要件: <span style={MONO}>{item.refs.join(", ")}</span>
                </span>
              ) : null}
            </td>
            <td style={CELL}>
              {readOnly ? (
                (item.opportunity_label ?? "未設定")
              ) : (
                <select
                  style={{ ...INPUT, width: "auto" }}
                  aria-label={`${item.label} の決める機会`}
                  value={item.opportunity ?? ""}
                  disabled={busy}
                  onChange={(e) =>
                    onUpdate(item, { opportunity: e.target.value === "" ? null : (e.target.value as Opportunity) })
                  }
                >
                  <option value="" style={OPTION}>
                    未設定
                  </option>
                  {OPPORTUNITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} style={OPTION}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </td>
            <td style={CELL}>
              <Text color={STATUS_COLOR[item.status]} fontSize="$3">
                {savingKey === item.key ? "保存中…" : item.status_label}
              </Text>
              {readOnly ? null : (
                <XStack gap="$1" flexWrap="wrap" marginTop="$1">
                  {STATUS_ACTIONS.filter((a) => a.status !== item.status).map((a) => (
                    <Button
                      key={a.status}
                      size="$2"
                      disabled={busy}
                      onPress={() => onUpdate(item, { status: a.status })}
                      aria-label={`${item.label} を${a.label}`}
                    >
                      {a.label}
                    </Button>
                  ))}
                </XStack>
              )}
            </td>
            <td style={CELL}>
              <MemoCell item={item} readOnly={readOnly} busy={busy} onSave={(memo) => onUpdate(item, { memo })} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// メモ(打ち合わせで聞くことの要点)。「直す」で開き、保存で送る
function MemoCell({
  item,
  readOnly,
  busy,
  onSave,
}: {
  item: ConfirmationItemRead;
  readOnly: boolean;
  busy: boolean;
  onSave: (memo: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  if (readOnly || draft === null) {
    return (
      <YStack gap="$1">
        {item.memo ? <Text fontSize="$3">{item.memo}</Text> : null}
        {readOnly ? null : (
          <Button size="$2" chromeless alignSelf="flex-start" disabled={busy} onPress={() => setDraft(item.memo)}>
            {item.memo ? "メモを直す" : "メモを書く"}
          </Button>
        )}
      </YStack>
    );
  }
  return (
    <YStack gap="$1">
      <textarea
        style={INPUT}
        rows={2}
        maxLength={2000}
        aria-label={`${item.label} のメモ`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <XStack gap="$1">
        <Button
          size="$2"
          disabled={busy}
          onPress={() => {
            onSave(draft);
            setDraft(null);
          }}
        >
          保存
        </Button>
        <Button size="$2" chromeless onPress={() => setDraft(null)}>
          やめる
        </Button>
      </XStack>
    </YStack>
  );
}
