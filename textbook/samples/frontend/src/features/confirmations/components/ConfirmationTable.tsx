// 作成：Phase-98-1｜更新：Phase-99(完了後の調整),109-3
"use client";

// Phase-99(完了後の調整):追記 ── next/link.Link, @/features/confirmations/confirmationOps.rowLock
// Phase-109-3:追記 ── @/features/change-requests/changeRequestOps.changeRequestHref, @/features/confirmations/confirmationOps.changedByLabel
import { useState } from "react";
import Link from "next/link";
import { Button, Text, XStack, YStack } from "tamagui";
import type {
  ConfirmationItemRead,
  ConfirmationStatus,
  ConfirmationUpdate,
  Opportunity,
} from "@/features/confirmations/api/types";
import { changeRequestHref } from "@/features/change-requests/changeRequestOps";
import { changedByLabel, KIND_LABEL, OPPORTUNITY_OPTIONS, rowLock } from "@/features/confirmations/confirmationOps";
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

// Phase-99(完了後の調整)：更新
// // 確認事項の表。行ごとに決める機会・状態・メモを変える(変えたらすぐ onUpdate)。readOnly は一覧から
// // 消えた項目(決めた記録)の表示で、操作を出さない。
// ↓↓
// 確認事項の表。行ごとに決める機会・状態・メモを変える(変えたらすぐ onUpdate)。今の一覧に無い行
// (rowLock)は、状態と決める機会を変えられないので操作の代わりに理由を出す(採用して合意した要件・
// Phase-109-3：更新
// // 利用者は、変更要求へのリンク)。メモはどの行も書ける。
// ↓↓
// 利用者は、変更要求へのリンク)。CR の反映で文が変わって未確認に戻った行は、その CR へのリンクを
// 状態の文の下の段に出す。メモはどの行も書ける。
export function ConfirmationTable({
  // Phase-99(完了後の調整):追記
  projectId,
  items,
  label,
  savingKey,
  // Phase-99(完了後の調整)：削除
  // readOnly = false,
  onUpdate,
}: {
  // Phase-99(完了後の調整):追記
  projectId: string;
  items: ConfirmationItemRead[];
  label: string;
  // 保存中の項目のキー(その間はすべての行の操作を止める)
  savingKey: string | null;
  // Phase-99(完了後の調整)：削除
  // readOnly?: boolean;
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
        {/* Phase-99(完了後の調整)：更新 */}
        {/* {items.map((item) => ( */}
        {/* ↓↓ */}
        {items.map((item) => {
          const lock = rowLock(item);
          // Phase-109-3:追記
          const changedBy = changedByLabel(item);
          return (
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
              {/* Phase-99(完了後の調整)：更新 */}
              {/* {readOnly ? ( */}
              {/* ↓↓ */}
              {lock.locked ? (
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
                {/* Phase-99(完了後の調整)：更新 */}
                {/* {savingKey === item.key ? "保存中…" : item.status_label} */}
                {/* ↓↓ */}
                {savingKey === item.key ? "保存中…" : lock.locked ? lock.label : item.status_label}
              </Text>
              {/* Phase-109-3:追記 */}
              {changedBy !== null && item.changed_by_change_request_number !== null ? (
                // 状態の文の下の段に出す(2段。下の「変更要求(CR)で →」と同じ形)
                <Link
                  href={changeRequestHref(projectId, item.changed_by_change_request_number)}
                  style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--blue10)" }}
                >
                  {`${changedBy} →`}
                </Link>
              ) : null}
              {/* Phase-99(完了後の調整)：更新 */}
              {/* {readOnly ? null : ( */}
              {/* ↓↓ */}
              {lock.locked ? (
                lock.viaChangeRequest ? (
                  // 状態の文の下の段に出す(2段)
                  <Link
                    href={`/projects/${projectId}/change-requests`}
                    style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--blue10)" }}
                  >
                    変えるときは変更要求(CR)で →
                  </Link>
                ) : null
              ) : (
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
              {/* Phase-99(完了後の調整)：更新 */}
              {/* <MemoCell item={item} readOnly={readOnly} busy={busy} onSave={(memo) => onUpdate(item, { memo })} /> */}
              {/* ↓↓ */}
              <MemoCell item={item} busy={busy} onSave={(memo) => onUpdate(item, { memo })} />
            </td>
          </tr>
          // Phase-99(完了後の調整)：更新
          // ))}
          // ↓↓
          );
        })}
      </tbody>
    </table>
  );
}

// メモ(打ち合わせで聞くことの要点)。「直す」で開き、保存で送る
function MemoCell({
  item,
  // Phase-99(完了後の調整)：削除
  // readOnly,
  busy,
  onSave,
}: {
  item: ConfirmationItemRead;
  // Phase-99(完了後の調整)：削除
  // readOnly: boolean;
  busy: boolean;
  onSave: (memo: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Phase-99(完了後の調整)：更新
  // if (readOnly || draft === null) {
  // ↓↓
  if (draft === null) {
    return (
      <YStack gap="$1">
        {item.memo ? <Text fontSize="$3">{item.memo}</Text> : null}
        {/* Phase-99(完了後の調整)：更新 */}
        {/* {readOnly ? null : ( */}
        {/* <Button size="$2" chromeless alignSelf="flex-start" disabled={busy} onPress={() => setDraft(item.memo)}> */}
        {/* {item.memo ? "メモを直す" : "メモを書く"} */}
        {/* </Button> */}
        {/* )} */}
        {/* ↓↓ */}
        <Button size="$2" chromeless alignSelf="flex-start" disabled={busy} onPress={() => setDraft(item.memo)}>
          {item.memo ? "メモを直す" : "メモを書く"}
        </Button>
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
