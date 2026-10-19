// 作成：Phase-51-3
"use client";

import { useState, type CSSProperties } from "react";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { DEMO_FINDINGS, DEMO_POINTS } from "./demoData";
import {
  CAUSE_LABEL,
  DECISION_LABEL,
  LEVEL_LABEL,
  POINT_STATUS_LABEL,
  decisionCounts,
  gateStatus,
  gatesOf,
  regenerationInstruction,
  rehearingQuestions,
  reopenPoints,
  reviewEnabled,
  sortFindings,
  unreviewedNotice,
  type Decision,
  type Gate,
  type GateStatus,
  type Level,
  type Mode,
} from "./reviewModel";

// ステージ8で作る AI 設計レビューの見せ方を、仮データで確かめるデモページ。バックエンドとは通信しない。
// レビューを流す区切り(自動・ボタン)、指摘のパネルと採否、採用した指摘からの再生成の指示と再ヒアリングを見せる。

const CARD: CSSProperties = {
  border: "1px solid var(--borderColor)",
  borderRadius: 8,
  padding: 12,
  background: "var(--color2)",
};
const PRE: CSSProperties = { ...CARD, whiteSpace: "pre-wrap", fontSize: 12, margin: 0 };

const LEVEL_COLOR: Record<Level, string> = { critical: "var(--red10)", major: "var(--orange10)", minor: "var(--color10)" };
const STATUS_TEXT: Record<GateStatus, string> = {
  not_ready: "文書がまだ無い",
  unreviewed: "未レビュー",
  reviewed: "レビュー済み",
  failed: "失敗(自己診断に切り替え)",
};
const STATUS_COLOR: Record<GateStatus, string> = {
  not_ready: "var(--color10)",
  unreviewed: "var(--red10)",
  reviewed: "var(--green10)",
  failed: "var(--orange10)",
};
const DECISIONS: Decision[] = ["adopted", "rejected", "held"];

// 区切りの文書がそろうための段階の承認(自動の区切りは生成済みとして始める)
const APPROVAL_LABEL: Record<string, string> = { "detailed-stage6": "段階6を承認する", "detailed-stage7": "段階7を承認する" };

export function DesignReviewDemoPageContent() {
  const [isSuperuser, setIsSuperuser] = useState(true);
  const [reviewSetting, setReviewSetting] = useState(true);
  const [mode, setMode] = useState<Mode>("detailed");
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set(["simple-docs", "detailed-docs"]));
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [unavailable, setUnavailable] = useState(false);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);

  const enabled = reviewEnabled({ isSuperuser, reviewSetting });
  const gates = gatesOf(mode);
  const ready = (g: Gate) => g.trigger === "auto" || approved.has(g.key);
  const statuses = gates.map((g) => ({ gate: g, status: gateStatus(ready(g), reviewed.has(g.key), failed.has(g.key)) }));
  const findings = sortFindings(DEMO_FINDINGS[mode].filter((f) => reviewed.has(f.gate)));
  const counts = decisionCounts(findings, decisions);
  const instruction = regenerationInstruction(findings, decisions);
  const { points, reopened } = reopenPoints(DEMO_POINTS[mode], findings, decisions);
  const questions = rehearingQuestions(DEMO_POINTS[mode], findings, decisions);

  const selectMode = (next: Mode) => {
    setMode(next);
    setDecisions(new Map());
    setNotice(null);
  };
  const runReview = (key: string) => {
    if (unavailable) {
      setFailed((prev) => new Set(prev).add(key));
      return;
    }
    setFailed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setReviewed((prev) => new Set(prev).add(key));
  };
  const approve = (key: string) => setApproved((prev) => new Set(prev).add(key));
  const decide = (id: string, decision: Decision) => setDecisions((prev) => new Map(prev).set(id, decision));

  return (
    <YStack gap="$5" padding="$4" maxWidth={1200} width="100%" marginHorizontal="auto">
      <YStack gap="$2">
        <H2>AI 設計レビューデモ</H2>
        <Paragraph color="$color10">
          ステージ8で作る AI 設計レビューの見せ方を、仮データで確かめるページです。生成は今のモデルのまま、レビューは別のモデルが指摘だけを返します。
          題材は Devex 自身で、appendix/measurements/stage8-baseline.md の測定と同じ生成物の指摘を縮めたものです。サーバーとは通信しません。
        </Paragraph>
      </YStack>

      <YStack gap="$2">
        <H3>アカウントと設定</H3>
        <XStack gap="$2" flexWrap="wrap" alignItems="center">
          <Button size="$2" theme={isSuperuser ? "blue" : undefined} aria-pressed={isSuperuser} onPress={() => setIsSuperuser(true)}>
            superuser
          </Button>
          <Button size="$2" theme={!isSuperuser ? "blue" : undefined} aria-pressed={!isSuperuser} onPress={() => setIsSuperuser(false)}>
            一般ユーザー
          </Button>
          <label style={{ fontSize: 13 }}>
            <input
              type="checkbox"
              checked={reviewSetting}
              disabled={!isSuperuser}
              onChange={(e) => setReviewSetting(e.target.checked)}
            />{" "}
            AI 設計レビューを使う
          </label>
        </XStack>
        <Text fontSize="$2" aria-label="レビューの状態">
          {enabled
            ? "レビュー: オン(生成の後に Sonnet がレビューする)"
            : isSuperuser
              ? "レビュー: オフ(今の自己診断を出す)"
              : "レビュー: オフ(superuser だけが使える。今の自己診断を出す)"}
        </Text>
      </YStack>

      <YStack gap="$2">
        <H3>モードとレビューの区切り</H3>
        <XStack gap="$2">
          {(["simple", "detailed"] as Mode[]).map((m) => (
            <Button key={m} size="$2" theme={m === mode ? "blue" : undefined} aria-pressed={m === mode} onPress={() => selectMode(m)}>
              {m === "simple" ? "簡易モード" : "詳細設計モード"}
            </Button>
          ))}
        </XStack>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={unavailable} onChange={(e) => setUnavailable(e.target.checked)} /> レビューのモデルが使えない(障害・キー無し・上限)
        </label>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="レビューの区切り">
            <thead>
              <tr>
                {["区切り", "流し方", "渡す文書", "状態", "操作"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statuses.map(({ gate, status }) => (
                <tr key={gate.key}>
                  <td style={CELL}>{gate.label}</td>
                  <td style={CELL}>{gate.trigger === "auto" ? "自動" : "ボタン"}</td>
                  <td style={CELL}>{gate.documents.join("・")}</td>
                  <td style={CELL}>
                    <span style={{ color: enabled ? STATUS_COLOR[status] : "var(--color10)", fontSize: 12, fontWeight: 600 }}>
                      {enabled ? STATUS_TEXT[status] : "オフ(自己診断)"}
                    </span>
                  </td>
                  <td style={CELL}>
                    <XStack gap="$1" flexWrap="wrap">
                      {status === "not_ready" && (
                        <Button size="$1" onPress={() => approve(gate.key)}>
                          {APPROVAL_LABEL[gate.key]}
                        </Button>
                      )}
                      {enabled && status !== "not_ready" && (
                        <Button size="$1" onPress={() => runReview(gate.key)} aria-label={`${gate.label}でレビューする`}>
                          {status === "unreviewed" ? "レビューする" : "もう一度レビュー"}
                        </Button>
                      )}
                    </XStack>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {enabled && mode === "detailed" && (
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <Button size="$2" onPress={() => setNotice(unreviewedNotice(statuses) ?? "すべての区切りをレビュー済みです。手順書を生成します。")}>
              実装手順書を生成する
            </Button>
            {notice && (
              <Text fontSize="$2" role="status">
                {notice}
              </Text>
            )}
          </XStack>
        )}
      </YStack>

      {enabled && (
        <YStack gap="$2">
          <H3>指摘</H3>
          <Paragraph fontSize="$2" color="$color10">
            {`採用 ${counts.adopted} ・ 却下 ${counts.rejected} ・ 保留 ${counts.held} ・ 未判断 ${counts.open}`}
            ── 設計は書き換えません。採用した指摘だけを、再生成と聞き直しに使います。
          </Paragraph>
          <div style={{ overflowX: "auto" }}>
            <table style={TABLE} aria-label="指摘の一覧">
              <thead>
                <tr>
                  {["重要度", "原因", "対象", "問題と根拠", "改善案", "判断"].map((h) => (
                    <th key={h} style={HEAD}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => {
                  const decision = decisions.get(f.id) ?? "open";
                  return (
                    <tr key={f.id}>
                      <td style={CELL}>
                        <span style={{ ...BADGE, color: LEVEL_COLOR[f.level] }}>{LEVEL_LABEL[f.level]}</span>
                      </td>
                      <td style={CELL}>{CAUSE_LABEL[f.cause]}</td>
                      <td style={{ ...CELL, ...MONO }}>{f.targets.join(", ")}</td>
                      <td style={CELL}>
                        <YStack gap="$1">
                          <Text fontSize="$2">{f.problem}</Text>
                          <Text fontSize="$1" color="$color10">{`引用: ${f.evidence}`}</Text>
                          <Text fontSize="$1" color="$color10">{`理由: ${f.reason}`}</Text>
                        </YStack>
                      </td>
                      <td style={CELL}>{f.suggestion}</td>
                      <td style={CELL}>
                        <XStack gap="$1" flexWrap="wrap">
                          {DECISIONS.map((d) => (
                            <Button
                              key={d}
                              size="$1"
                              theme={decision === d ? "blue" : undefined}
                              aria-pressed={decision === d}
                              aria-label={`${f.id} を${DECISION_LABEL[d]}`}
                              onPress={() => decide(f.id, d)}
                            >
                              {DECISION_LABEL[d]}
                            </Button>
                          ))}
                        </XStack>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </YStack>
      )}

      {enabled && (
        <YStack gap="$2">
          <H3>差し戻し</H3>
          <Paragraph fontSize="$2" color="$color10">
            原因が設計・不整合の指摘は、再生成の指示に入れます(直すのは生成のモデル)。原因がヒアリングの指摘は、観点を「未決」に戻してチャットで聞き直します。
          </Paragraph>
          <Text fontWeight="600">再生成の指示</Text>
          {instruction ? (
            <pre style={PRE} aria-label="再生成の指示">
              {instruction}
            </pre>
          ) : (
            <Text fontSize="$2" color="$color10">
              採用した設計・不整合の指摘はありません。
            </Text>
          )}
          <Text fontWeight="600">ヒアリングの観点</Text>
          <table style={TABLE} aria-label="ヒアリングの観点">
            <thead>
              <tr>
                {["観点", "状態", "内容"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <td style={CELL}>{p.label}</td>
                  <td style={CELL}>
                    <span style={{ color: reopened.includes(p.key) ? "var(--red10)" : undefined, fontWeight: reopened.includes(p.key) ? 600 : undefined }}>
                      {reopened.includes(p.key) ? "未決に戻した" : POINT_STATUS_LABEL[p.status]}
                    </span>
                  </td>
                  <td style={CELL}>{p.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {questions.length > 0 && (
            <YStack gap="$1" aria-label="聞き直し">
              <Text fontWeight="600">チャットでの聞き直し(AI の最初の問いかけ)</Text>
              {questions.map((q) => (
                <Text key={q} fontSize="$2">
                  {q}
                </Text>
              ))}
            </YStack>
          )}
        </YStack>
      )}
    </YStack>
  );
}
