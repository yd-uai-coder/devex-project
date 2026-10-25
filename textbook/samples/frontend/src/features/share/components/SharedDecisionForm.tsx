// 作成：Phase-108-3
"use client";

import { useState } from "react";
import { Button, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import type { SharedChangeRequestRead } from "@/features/share/api/types";
import { useShareStore } from "@/features/share/share-store";
import { DECISION_REASON_MAX, decisionProblem } from "@/features/share/shareOps";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { INPUT } from "@/features/detailed-design/components/tableStyles";

type Decision = "agreed" | "rejected";

// 共有リンクの画面の「ご判断」。案のある CR では案を選び(初めは選ばない。おすすめの印と理由を添える)、
// 理由を書いて合意か却下を押す。先に押した方で決まり後から直せないので、記録の前に確かめる
export function SharedDecisionForm({ shared }: { shared: SharedChangeRequestRead }) {
  const name = useShareStore((s) => s.name);
  const deciding = useShareStore((s) => s.deciding);
  const decisionError = useShareStore((s) => s.decisionError);
  const decide = useShareStore((s) => s.decide);
  const [option, setOption] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const options = shared.options;
  const chosen = options.find((o) => o.number === option) ?? null;

  const ask = (decision: Decision) => {
    const issue = decisionProblem({ decision, name, option, reason, optionCount: options.length });
    setProblem(issue);
    if (!issue) setConfirming(decision);
  };

  const record = async () => {
    const decision = confirming;
    setConfirming(null);
    if (decision) await decide({ decision, option, reason });
  };

  return (
    <YStack gap="$3" aria-label="ご判断">
      <H3 fontSize="$6">ご判断</H3>
      {options.length > 0 ? (
        <YStack gap="$2">
          <Text>合意するときは、案を1つ選んでください(案の中身と規模は説明書の「選択肢」「変更の規模」にあります)。</Text>
          <div role="radiogroup" aria-label="合意する案" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map((o) => (
              <label
                key={o.number}
                style={{
                  display: "block",
                  padding: 8,
                  border: "1px solid var(--borderColor)",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="shared-option"
                  value={o.number}
                  checked={option === o.number}
                  onChange={() => setOption(o.number)}
                  aria-label={`${o.label} ${o.name}`}
                />{" "}
                <strong>{`${o.label} ${o.name}`}</strong>
                {o.recommended ? <span style={{ marginLeft: 8, color: "var(--green11)" }}>★ 開発者のおすすめ</span> : null}
                <span style={{ display: "block", marginTop: 4, whiteSpace: "pre-wrap" }}>{o.outcome}</span>
              </label>
            ))}
          </div>
          {shared.recommended_reason ? (
            <Paragraph color="$color11">{`おすすめの理由: ${shared.recommended_reason}`}</Paragraph>
          ) : null}
        </YStack>
      ) : null}
      <label style={{ display: "block", fontSize: 13 }}>
        理由(却下では必須。合意では任意)
        <textarea
          style={{ ...INPUT, display: "block", width: "100%", marginTop: 4 }}
          rows={3}
          maxLength={DECISION_REASON_MAX}
          aria-label="判断の理由"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <XStack gap="$3">
        <Button size="$3" theme="green" disabled={deciding !== null} onPress={() => ask("agreed")}>
          {deciding === "agreed" ? "記録中..." : "合意する"}
        </Button>
        <Button size="$3" theme="red" disabled={deciding !== null} onPress={() => ask("rejected")}>
          {deciding === "rejected" ? "記録中..." : "却下する"}
        </Button>
      </XStack>
      {problem || decisionError ? (
        <Text role="alert" color="$red10">
          {problem ?? decisionError}
        </Text>
      ) : null}
      <ConfirmDialog
        open={confirming !== null}
        title={confirming === "agreed" ? "この変更に合意しますか" : "この変更を却下しますか"}
        description={
          <>
            {confirming === "agreed" && chosen ? `選んだ案: ${chosen.label} ${chosen.name}。` : ""}
            {`「${name.trim()}」として記録します。記録した判断は、このページから直せません。`}
          </>
        }
        confirmLabel={confirming === "agreed" ? "合意を記録する" : "却下を記録する"}
        onConfirm={() => void record()}
        onCancel={() => setConfirming(null)}
      />
    </YStack>
  );
}
