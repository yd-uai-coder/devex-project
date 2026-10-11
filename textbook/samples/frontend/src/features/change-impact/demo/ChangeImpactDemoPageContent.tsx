// 作成：Phase-41-3
"use client";

import { useState, type CSSProperties } from "react";
import { Button, H2, H3, Paragraph, Text, XStack, YStack } from "tamagui";
import { BADGE, CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { DEMO_CHANGES, DEMO_ELEMENTS } from "./demoData";
import {
  CHANGE_KIND_LABEL,
  STAGE_LABEL,
  canReapprove,
  elementMap,
  impactOf,
  pathText,
  regenerationTargets,
  stageMarks,
  type StageMark,
} from "./impactModel";

// ステージ7で作る変更の影響範囲の見せ方を、仮データで確かめるデモページ。バックエンドとは通信しない。
// 影響の一覧(パネル)と、各段階の表の行の印の両方を見せる(どちらに置くかを決める材料)。

const CARD: CSSProperties = {
  border: "1px solid var(--borderColor)",
  borderRadius: 8,
  padding: 12,
  background: "var(--color2)",
};
const FOCUS_ROW: CSSProperties = { background: "var(--yellow4)" };

function markText(mark: StageMark): string {
  if (!mark.outdated && mark.open + mark.reviewed === 0) return "影響なし";
  const head = mark.outdated ? "古い" : "古くない";
  if (canReapprove(mark)) return `${head}・見直し済み → 承認し直せる`;
  return `${head}・見直し ${mark.open} / 確認済み ${mark.reviewed}`;
}

function markColor(mark: StageMark): string {
  if (mark.open > 0) return "var(--red10)";
  if (mark.outdated) return "var(--green10)";
  return "var(--color10)";
}

export function ChangeImpactDemoPageContent() {
  const [changeId, setChangeId] = useState(DEMO_CHANGES[0].id);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<{ stage: number; key: string } | null>(null);

  const change = DEMO_CHANGES.find((c) => c.id === changeId) ?? DEMO_CHANGES[0];
  const byKey = elementMap(DEMO_ELEMENTS);
  const items = impactOf(DEMO_ELEMENTS, change);
  const itemByKey = new Map(items.map((i) => [i.key, i]));
  const marks = stageMarks(DEMO_ELEMENTS, change, items, reviewed);
  const targets = regenerationTargets(DEMO_ELEMENTS, items);
  const tableStage = focus?.stage ?? marks.find((m) => m.open > 0)?.stage ?? 1;
  const stageRows = DEMO_ELEMENTS.filter((e) => e.stage === tableStage);

  const selectChange = (id: string) => {
    setChangeId(id);
    setReviewed(new Set());
    setFocus(null);
  };
  const markReviewed = (key: string) => setReviewed((prev) => new Set(prev).add(key));

  return (
    <YStack gap="$5" padding="$4" maxWidth={1200} width="100%" marginHorizontal="auto">
      <YStack gap="$2">
        <H2>変更の影響デモ</H2>
        <Paragraph color="$color10">
          ステージ7で作る変更の影響範囲の見せ方を、仮データで確かめるページです。題材は Devex 自身で、appendix/stage7-baseline/
          のベースラインと同じ生成物を縮めたものです。サーバーとは通信しません。
        </Paragraph>
      </YStack>

      <YStack gap="$2">
        <H3>変更を選ぶ</H3>
        <XStack gap="$2" flexWrap="wrap">
          {DEMO_CHANGES.map((c) => (
            <Button key={c.id} size="$2" theme={c.id === changeId ? "blue" : undefined} aria-pressed={c.id === changeId} onPress={() => selectChange(c.id)}>
              {c.title}
            </Button>
          ))}
        </XStack>
        <div style={CARD} aria-label="変わったもの">
          <YStack gap="$1">
            <Text fontSize="$2" color="$color10">{`${STAGE_LABEL[byKey.get(change.key)?.stage ?? 0]} ・ ${CHANGE_KIND_LABEL[change.kind]}`}</Text>
            <Text fontWeight="600">{change.key}</Text>
            <Text fontSize="$2">{`前: ${change.before}`}</Text>
            <Text fontSize="$2">{`後: ${change.after}`}</Text>
            <Text fontSize="$1" color="$color10">前の値は、直前に承認したときの写し(文書は前の版の model)から取ります。</Text>
          </YStack>
        </div>
      </YStack>

      <YStack gap="$2">
        <H3>段階の状態</H3>
        <Paragraph fontSize="$2" color="$color10">
          段階の「古い」は今の仕組みのまま残し、その中で見直しが要る要素に印を付けます。印がすべて確認済みになれば、段階を承認し直せます。
        </Paragraph>
        <XStack gap="$2" flexWrap="wrap" role="list" aria-label="段階の状態">
          {marks.map((m) => (
            <div key={m.stage} role="listitem" style={{ ...CARD, padding: 8, minWidth: 150 }}>
              <Text fontSize="$1" color="$color10">{STAGE_LABEL[m.stage]}</Text>
              <span style={{ display: "block", color: markColor(m), fontSize: 12, fontWeight: 600 }}>{markText(m)}</span>
            </div>
          ))}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <H3>影響の一覧</H3>
        <Paragraph fontSize="$2" color="$color10">
          変更が届く処理(F-xx)に属する要素だけを示します。共有されるモジュールからは広げません。理由は参照の種類から書きます。
        </Paragraph>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="影響の一覧">
            <thead>
              <tr>
                {["置き場", "要素", "たどった道", "理由", "状態", "操作"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const element = byKey.get(item.key);
                const stage = element?.stage ?? 0;
                const done = reviewed.has(item.key);
                return (
                  <tr key={item.key}>
                    <td style={CELL}>{STAGE_LABEL[stage]}</td>
                    <td style={CELL}>
                      <span style={MONO}>{item.key}</span>
                      <Text fontSize="$1" color="$color10">{` ${element?.label ?? ""}`}</Text>
                    </td>
                    <td style={{ ...CELL, ...MONO }}>{pathText(item.path)}</td>
                    <td style={CELL}>{item.reason}</td>
                    <td style={CELL}>
                      <span style={{ color: done ? "var(--green10)" : "var(--red10)", fontSize: 12, fontWeight: 600 }}>
                        {done ? "確認済み" : "見直し"}
                      </span>
                    </td>
                    <td style={CELL}>
                      <XStack gap="$1" flexWrap="wrap">
                        {!done && (
                          <Button size="$1" onPress={() => markReviewed(item.key)} aria-label={`${item.key} を確認済みにする`}>
                            確認済みにする
                          </Button>
                        )}
                        {stage > 0 && (
                          <Button size="$1" onPress={() => setFocus({ stage, key: item.key })} aria-label={`${item.key} を段階の表で見る`}>
                            表で見る
                          </Button>
                        )}
                      </XStack>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </YStack>

      <YStack gap="$2" aria-label="再生成の候補">
        <H3>再生成の候補</H3>
        <Paragraph fontSize="$2" color="$color10">
          部分再生成できる段階(5 手順・6 処理ロジック・8 単位の手順書)の要素です。自動では再生成しません。
        </Paragraph>
        <XStack gap="$2" flexWrap="wrap">
          {targets.length > 0 ? (
            targets.map((t) => (
              <span key={t.key} style={BADGE}>
                {`段階${t.stage}: ${t.key}`}
              </span>
            ))
          ) : (
            <Text fontSize="$2" color="$color10">候補はありません。</Text>
          )}
        </XStack>
      </YStack>

      <YStack gap="$2">
        <H3>{`段階の表(${STAGE_LABEL[tableStage]})`}</H3>
        <Paragraph fontSize="$2" color="$color10">
          各段階の表の行にも印を付けます。一覧の「表で見る」で、その行を強調して開きます。
        </Paragraph>
        <XStack gap="$1" flexWrap="wrap">
          {marks.map((m) => (
            <Button key={m.stage} size="$1" theme={m.stage === tableStage ? "blue" : undefined} aria-pressed={m.stage === tableStage} onPress={() => setFocus({ stage: m.stage, key: "" })}>
              {`段階${m.stage}`}
            </Button>
          ))}
        </XStack>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="段階の表">
            <thead>
              <tr>
                {["要素", "内容", "印"].map((h) => (
                  <th key={h} style={HEAD}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stageRows.map((e) => {
                const item = itemByKey.get(e.key);
                const focused = focus?.key === e.key;
                return (
                  <tr key={e.key} style={focused ? FOCUS_ROW : undefined} aria-current={focused ? "true" : undefined}>
                    <td style={{ ...CELL, ...MONO }}>{e.key}</td>
                    <td style={CELL}>{e.label}</td>
                    <td style={CELL}>
                      {e.key === change.key ? (
                        <span style={{ ...BADGE, color: "var(--blue10)" }}>変更</span>
                      ) : item ? (
                        <span style={{ ...BADGE, color: reviewed.has(e.key) ? "var(--green10)" : "var(--red10)" }}>
                          {reviewed.has(e.key) ? "確認済み" : "見直し"}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </YStack>
    </YStack>
  );
}
