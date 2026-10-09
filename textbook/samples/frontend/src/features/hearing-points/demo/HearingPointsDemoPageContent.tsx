// 作成：Phase-33-3
"use client";

import { useState, type CSSProperties } from "react";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, INPUT, TABLE } from "@/features/detailed-design/components/tableStyles";
import { DEMO_CARDS, DEMO_FUNCTIONS, DEMO_NEXT_TURN, DEMO_POINTS, DEMO_REQUIREMENTS, DEMO_UNITS } from "./demoData";
import {
  KIND_LABEL,
  POINT_DEFS,
  REQ_SOURCES,
  SCALES,
  SCALE_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  answerByCard,
  answerByText,
  countBySource,
  countByStatus,
  isSufficient,
  nextCard,
  openRequired,
  pointDef,
  trace,
  traceIssues,
  type CardOption,
  type PointStatus,
  type QuestionCard,
  type ReqSource,
  type Scale,
} from "./hearingPointsModel";

// ステージ6で作るヒアリングの観点の表・選択肢カード・要件の出どころ・要件からの追跡を、仮データで
// 確かめるデモページ。バックエンドとは通信しない。

const STATUS_COLOR: Record<PointStatus, string> = {
  decided: "var(--green10)",
  adopted: "var(--blue10)",
  open: "var(--red10)",
  not_applicable: "var(--color10)",
};
const SOURCE_COLOR: Record<ReqSource, string> = {
  user: "var(--green10)",
  adopted: "var(--blue10)",
  assumed: "var(--orange10)",
};
const CARD: CSSProperties = {
  border: "1px solid var(--borderColor)",
  borderRadius: 8,
  padding: 12,
  background: "var(--color2)",
};

function Chip({ text, color }: { text: string; color: string }) {
  return <span style={{ color, fontSize: 12, whiteSpace: "nowrap", fontWeight: 600 }}>{text}</span>;
}

function CardView({
  card,
  onChoose,
  onAnswer,
}: {
  card: QuestionCard;
  onChoose: (option: CardOption) => void;
  onAnswer: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const def = pointDef(card.point);
  return (
    <div style={CARD} aria-label="選択肢カード">
      <YStack gap="$2">
        <Text fontSize="$2" color="$color10">{`観点: ${def.label}(${KIND_LABEL[def.kind]})`}</Text>
        <Text fontWeight="600">{card.question}</Text>
        {card.options.map((option) => (
          <XStack key={option.label} gap="$3" alignItems="flex-start" flexWrap="wrap">
            <Button size="$3" theme={option.recommended ? "blue" : undefined} onPress={() => onChoose(option)}>
              {option.label}
            </Button>
            <YStack flex={1} minWidth={220} gap="$1">
              <Text fontSize="$2">{option.consequence}</Text>
              {option.recommended && <span style={{ ...BADGE, alignSelf: "flex-start" }}>おすすめ</span>}
            </YStack>
          </XStack>
        ))}
        <XStack gap="$2" alignItems="center">
          <input
            aria-label="自分の言葉で答える"
            placeholder="選択肢に無ければ、自分の言葉で"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ ...INPUT, flex: 1 }}
          />
          <Button
            size="$3"
            disabled={text.trim() === ""}
            opacity={text.trim() === "" ? 0.5 : 1}
            onPress={() => {
              onAnswer(text);
              setText("");
            }}
          >
            答える
          </Button>
        </XStack>
        <Text fontSize="$1" color="$color10">
          選択肢を選ぶと「AI の提案を採用」、自分の言葉で答えると「ユーザーが決定」になります。
        </Text>
      </YStack>
    </div>
  );
}

export function HearingPointsDemoPageContent() {
  const [points, setPoints] = useState(DEMO_POINTS);
  const [scale, setScale] = useState<Scale>("personal");
  const [turn, setTurn] = useState(DEMO_NEXT_TURN);

  const card = nextCard(DEMO_CARDS, points, scale);
  const missing = openRequired(points, scale);
  const sufficient = isSufficient(points, scale);
  const statusCounts = countByStatus(points);
  const sourceCounts = countBySource(DEMO_REQUIREMENTS);
  const state = new Map(points.map((p) => [p.key, p]));
  const rows = trace(DEMO_REQUIREMENTS, DEMO_FUNCTIONS, DEMO_UNITS);
  const issues = traceIssues(DEMO_REQUIREMENTS, DEMO_FUNCTIONS);

  const evidence = `カード(発言${turn})`;
  const choose = (option: CardOption) => {
    if (!card) return;
    setPoints((prev) => answerByCard(prev, card, option, evidence));
    setTurn((t) => t + 1);
  };
  const answer = (text: string) => {
    if (!card) return;
    setPoints((prev) => answerByText(prev, card.point, text, `発言${turn}`));
    setTurn((t) => t + 1);
  };

  return (
    <YStack gap="$5" padding="$4" maxWidth={1200} width="100%" marginHorizontal="auto">
      <YStack gap="$2">
        <H2>ヒアリングの観点の表デモ</H2>
        <Paragraph color="$color10">
          ステージ6で作るヒアリングの見せ方を、仮データで確かめるページです。題材は Devex 自身で、appendix/structured-requirements-sample/
          の見本と同じ中身です。サーバーとは通信しません。
        </Paragraph>
      </YStack>

      <YStack gap="$2">
        <H3>規模</H3>
        <XStack gap="$2" flexWrap="wrap">
          {SCALES.map((s) => (
            <Button key={s} size="$2" theme={scale === s ? "blue" : undefined} aria-pressed={scale === s} onPress={() => setScale(s)}>
              {SCALE_LABEL[s]}
            </Button>
          ))}
        </XStack>
        <Text fontSize="$2" color="$color10">
          規模で必須の観点が変わります。必須でも「対象外」と決めれば済みます。
        </Text>
      </YStack>

      <YStack gap="$2" role="status">
        {sufficient ? (
          <Text color="$green10">必須の観点がすべて決まりました。サマリを出し、設計書を生成できます。</Text>
        ) : (
          <Text color="$red10">{`未決の必須の観点: ${missing.map((d) => d.label).join("、")}`}</Text>
        )}
      </YStack>

      {card ? (
        <CardView key={card.point} card={card} onChoose={choose} onAnswer={answer} />
      ) : (
        <Text fontSize="$2" color="$color10">出すカードはありません。</Text>
      )}

      <YStack gap="$2">
        <H3>観点の表</H3>
        <XStack gap="$3" flexWrap="wrap">
          {(Object.keys(STATUS_LABEL) as PointStatus[]).map((s) => (
            <Chip key={s} text={`${STATUS_LABEL[s]} ${statusCounts[s]}`} color={STATUS_COLOR[s]} />
          ))}
        </XStack>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="観点の表">
            <thead>
              <tr>
                {["観点", "種類", "必須", "状態", "決めたこと", "根拠"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POINT_DEFS.map((def) => {
                const p = state.get(def.key);
                const status = p?.status ?? "open";
                return (
                  <tr key={def.key}>
                    <td style={CELL}>{def.label}</td>
                    <td style={CELL}>{KIND_LABEL[def.kind]}</td>
                    <td style={CELL}>{def.required[scale] ? "○" : ""}</td>
                    <td style={CELL}>
                      <Chip text={STATUS_LABEL[status]} color={STATUS_COLOR[status]} />
                    </td>
                    <td style={CELL}>{p?.summary || def.question}</td>
                    <td style={CELL}>{p?.evidence ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </YStack>

      <YStack gap="$2">
        <H3>要件の一覧(出どころ)</H3>
        <XStack gap="$3" flexWrap="wrap">
          {REQ_SOURCES.map((s) => (
            <Chip key={s} text={`${SOURCE_LABEL[s]} ${sourceCounts[s]}`} color={SOURCE_COLOR[s]} />
          ))}
        </XStack>
        <Paragraph fontSize="$2" color="$color10">
          「推測」は AI が補った要件です(利用者は言っていない)。確かめれば「採用」になります。
        </Paragraph>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="要件の一覧">
            <thead>
              <tr>
                {["ID", "優先度", "要件", "出どころ", "観点"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_REQUIREMENTS.map((r) => (
                <tr key={r.id}>
                  <td style={CELL}>{r.id}</td>
                  <td style={CELL}>{r.priority ?? ""}</td>
                  <td style={CELL}>{r.text}</td>
                  <td style={CELL}>
                    <Chip text={SOURCE_LABEL[r.source]} color={SOURCE_COLOR[r.source]} />
                  </td>
                  <td style={CELL}>{pointDef(r.point).label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </YStack>

      <YStack gap="$2">
        <H3>要件 → 処理 → 作業単位</H3>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="要件からの追跡">
            <thead>
              <tr>
                {["要件", "優先度", "処理(段階1)", "作業単位(段階7)"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ req, functions, units }) => (
                <tr key={req.id}>
                  <td style={CELL}>{req.id}</td>
                  <td style={CELL}>{req.priority ?? ""}</td>
                  <td style={CELL}>
                    {functions.length > 0 ? (
                      functions.map((f) => `${f.id} ${f.name}`).join("、")
                    ) : (
                      <Text color="$red10" fontSize="$2">なし</Text>
                    )}
                  </td>
                  <td style={CELL}>{units.map((u) => u.id).join("、")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <YStack gap="$1" aria-label="追跡の指摘">
          {issues.map((issue) => (
            <Text key={issue.message} fontSize="$2" color={issue.severity === "major" ? "$orange10" : "$color10"}>
              {`${issue.severity === "major" ? "中程度" : "軽微"}: ${issue.message}`}
            </Text>
          ))}
        </YStack>
      </YStack>
    </YStack>
  );
}
