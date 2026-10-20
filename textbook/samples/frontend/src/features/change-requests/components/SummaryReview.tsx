"use client";
// 作成：Phase-88-4

import { useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import type { ExplanationSummaryRead } from "@/features/change-requests/api/types";
import { markSegments, SUMMARY_TONE } from "@/features/change-requests/changeRequestOps";
import { BADGE, INPUT } from "@/features/detailed-design/components/tableStyles";

const SUMMARY_MAX = 4000;
const COLUMN = { flexBasis: 320, flexGrow: 1, flexShrink: 1, minWidth: 0 } as const;
const TEXT_BOX = {
  border: "1px solid var(--borderColor)",
  borderRadius: 6,
  padding: 8,
  whiteSpace: "pre-wrap",
  fontSize: 14,
  lineHeight: 1.6,
  margin: 0,
} as const;

// 照合で合わない所に印を付けた文
function MarkedText({ text, summary, label }: { text: string; summary: ExplanationSummaryRead; label: string }) {
  return (
    <p style={TEXT_BOX} aria-label={label}>
      {markSegments(text, summary.unknown_requirement_ids, summary.unknown_numbers).map((segment, index) =>
        segment.mark === null ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <mark
            key={index}
            title="5節に無い"
            style={{ background: "var(--red4)", color: "var(--red11)", borderRadius: 3, padding: "0 2px" }}
          >
            {segment.text}
          </mark>
        ),
      )}
    </p>
  );
}

// 要約の確認。LLM の元の文(左)と直す欄(右)を並べ、照合で合わない要件 ID・数字に印を付ける
// (照合は今の文が対象。元の文にも同じ ID・数字に印を付ける)。人は直して保存し、「確認した」を押す
// (合わない所があっても押せる。人が判断する)。直す欄に保存していない直しがある間は確認できない。
// 狭い画面では2つの列を上下に積む
export function SummaryReview({
  summary,
  busy,
  onSave,
  onConfirm,
}: {
  summary: ExplanationSummaryRead;
  busy: boolean;
  onSave: (text: string) => void;
  onConfirm: () => void;
}) {
  // 直す欄の初期値は今の文。親は、作り直し・保存で文が変わったら key で作り直す
  const [draft, setDraft] = useState(summary.text);
  const dirty = draft.trim() !== summary.text;
  const tooLong = draft.trim().length > SUMMARY_MAX;
  const unknowns = [...summary.unknown_requirement_ids, ...summary.unknown_numbers];
  const tone = SUMMARY_TONE[summary.state];

  return (
    <YStack gap="$2">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <span
          style={{
            ...BADGE,
            color: `var(--${tone}11)`,
            borderColor: `var(--${tone}8)`,
            background: `var(--${tone}2)`,
          }}
          aria-label={`要約の状態: ${summary.state_label}`}
        >
          {summary.state_label}
        </span>
        <Text color="$color11" fontSize="$2">
          {summary.generated_model ?? "モデル不明"} ・{new Date(summary.generated_at).toLocaleString("ja-JP")} に作成
          {summary.edited_at ? ` ・${new Date(summary.edited_at).toLocaleString("ja-JP")} に直した` : ""}
          {summary.confirmed_at ? ` ・${new Date(summary.confirmed_at).toLocaleString("ja-JP")} に確認` : ""}
        </Text>
      </XStack>

      {unknowns.length > 0 ? (
        <Text color="$red10" role="status">
          ⚠ 5節に無い: {unknowns.join(" / ")}(直すか、問題が無いと判断してから確認してください)
        </Text>
      ) : (
        <Text color="$color11">要約の要件 ID・数字は、すべて5節にあります。</Text>
      )}

      <XStack gap="$3" flexWrap="wrap" alignItems="flex-start">
        <YStack {...COLUMN} gap="$1">
          <Text fontWeight="600">LLM の元の文</Text>
          <MarkedText text={summary.generated_text} summary={summary} label="LLM の元の文" />
        </YStack>
        <YStack {...COLUMN} gap="$1">
          <label style={{ fontWeight: 600, fontSize: 14 }}>
            直す欄
            <textarea
              style={{ ...INPUT, minHeight: 160 }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          {tooLong ? <Text color="$red10">{`${SUMMARY_MAX}字までです。`}</Text> : null}
          {summary.edited ? (
            <>
              <Text color="$color11" fontSize="$2">
                保存した文(照合の対象)
              </Text>
              <MarkedText text={summary.text} summary={summary} label="保存した文" />
            </>
          ) : null}
        </YStack>
      </XStack>

      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <Button size="$3" disabled={busy || !dirty || tooLong || draft.trim() === ""} onPress={() => onSave(draft.trim())}>
          保存
        </Button>
        <Button size="$3" theme="green" disabled={busy || dirty || summary.state === "confirmed"} onPress={onConfirm}>
          確認した
        </Button>
        {dirty ? (
          <Paragraph color="$color11" size="$2">
            保存していない直しがあります。保存してから確認してください。
          </Paragraph>
        ) : null}
      </XStack>
    </YStack>
  );
}
