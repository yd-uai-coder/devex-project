// 作成：Phase-44-2｜更新：Phase-44-4,44(完了後の調整)
"use client";

// Phase-44-4:追記 ── @/features/detailed-design/components/RegenerationTargets.RegenerationTargets
// Phase-44(完了後の調整):追記 ── @/features/detailed-design/impactOps(stageMarkSummary, visibleMarks)
import { useState } from "react";
import Link from "next/link";
import { Button, Text, XStack, YStack } from "tamagui";
import type {
  ElementChangeRead,
  ImpactMarkRead,
  StageImpactRead,
} from "@/features/detailed-design/api/types";
import { ImpactBadge } from "@/features/detailed-design/components/ImpactBadge";
import { RegenerationTargets } from "@/features/detailed-design/components/RegenerationTargets";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  CHANGE_KIND_LABELS,
  hasImpact,
  markStatus,
  marksByKey,
  openMarkKeys,
  openTotal,
  pathText,
  sourceLabel,
  stageMarkSummary,
  visibleMarks,
} from "@/features/detailed-design/impactOps";
import { STAGE_TITLES } from "@/features/detailed-design/labels";

// 詳細設計画面の「変更の影響」パネル(docs/external_design.md 2.10節)。作業領域の上に全幅で置き、
// Phase-44-4：更新
// // 変わったもの → 段階ごとの影響の一覧(置き場・要素・たどった道・理由・状態)を出す。
// ↓↓
// 変わったもの → 段階ごとの影響の一覧(置き場・要素・たどった道・理由・状態)→ 再生成の候補を出す。
// 印を確認済みにし、「表で見る」でその段階の表の行を強調して開く。印も変わったものも無ければ出さない。
// Phase-44(完了後の調整):追記
// 全段階を並べると縦に長くなるので、初めは選んでいる段階の分だけを出す(「全段階」「未確認のみ」で切り替える)。
export function ChangeImpactPanel({ projectId }: { projectId: string }) {
  const impact = useDetailedDesignStore((s) => s.impact);
  const impactError = useDetailedDesignStore((s) => s.impactError);
  const reviewing = useDetailedDesignStore((s) => s.reviewing);
  const reviewMarks = useDetailedDesignStore((s) => s.reviewMarks);
  const showInTable = useDetailedDesignStore((s) => s.showInTable);
  // Phase-44(完了後の調整):追記
  const selectedStage = useDetailedDesignStore((s) => s.selectedStage);
  const selectStage = useDetailedDesignStore((s) => s.selectStage);
  const open = openTotal(impact);
  // 未確認の印があれば開いて出す
  const [expanded, setExpanded] = useState(open > 0);
  // Phase-44(完了後の調整):追記
  // 絞り込み: 段階はステッパーで選んでいる段階に追従し、allStages で全段階にする
  const [allStages, setAllStages] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);

  if (!hasImpact(impact) && !impactError) return null;

  const review = (stage: number, keys: string[], reviewed: boolean) =>
    void reviewMarks(projectId, stage, keys, reviewed);
  // Phase-44(完了後の調整)：更新
  // const stages = (impact?.stages ?? []).filter((s) => s.marks.length > 0);
  // ↓↓
  const inView = (stage: number) => allStages || stage === selectedStage;
  const summary = stageMarkSummary(impact);
  const shown = (impact?.stages ?? [])
    .filter((s) => s.marks.length > 0 && inView(s.stage))
    .map((item) => ({
      item,
      marks: visibleMarks([...marksByKey(impact, item.stage).values()], openOnly),
    }))
    .filter(({ marks }) => marks.length > 0);

  return (
    <YStack
      role="region"
      aria-label="変更の影響"
      gap="$3"
      padding="$3"
      borderWidth={1}
      borderColor={open > 0 ? "$red8" : "$borderColor"}
      borderRadius="$4"
    >
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <Text fontWeight="700">
          {open > 0 ? `変更の影響(未確認 ${open})` : "変更の影響"}
        </Text>
        <Button size="$2" aria-expanded={expanded} onPress={() => setExpanded(!expanded)}>
          {expanded ? "たたむ" : "開く"}
        </Button>
      </XStack>

      {impactError ? (
        <Text role="alert" color="$red10" fontSize="$2">
          {impactError}
        </Text>
      ) : null}

      {expanded && impact ? (
        <YStack gap="$4">
          <Text fontSize="$2" color="$color11">
            段階を承認したとき・文書の版が切り替わったときに、変わった要素から見直しが要る要素をたどって印を付けます。
            他の段階・文書から届いた印をすべて確認済みにすると、段階を承認し直せます。
          </Text>
          {/* Phase-44(完了後の調整)：更新
          <ChangeList projectId={projectId} stages={impact.stages} />
          {stages.map((item) => (
          ↓↓ */}
          <ImpactFilter
            summary={summary}
            selectedStage={selectedStage}
            allStages={allStages}
            openOnly={openOnly}
            onAllStages={() => setAllStages(true)}
            onStage={(stage) => {
              setAllStages(false);
              selectStage(stage);
            }}
            onOpenOnly={setOpenOnly}
          />
          <ChangeList
            projectId={projectId}
            stages={impact.stages.filter((s) => inView(s.stage))}
          />
          {shown.length === 0 ? (
            <Text fontSize="$2" color="$color11">
              {allStages
                ? "未確認の印はありません。"
                : openOnly
                  ? "この段階に未確認の印はありません。"
                  : "この段階に届いた印はありません。"}
            </Text>
          ) : null}
          {shown.map(({ item, marks }) => (
            <StageMarks
              key={item.stage}
              item={item}
              // Phase-44(完了後の調整)：更新
              // marks={[...marksByKey(impact, item.stage).values()]}
              // ↓↓
              marks={marks}
              openKeys={openMarkKeys(impact, item.stage)}
              disabled={reviewing}
              onReview={(keys, reviewed) => review(item.stage, keys, reviewed)}
              onShow={(key) => showInTable(item.stage, key)}
            />
          ))}
          {/* Phase-44-4:追記 */}
          {/* Phase-44(完了後の調整)：更新
          <RegenerationTargets projectId={projectId} targets={impact.regeneration_targets} />
          ↓↓ */}
          <RegenerationTargets
            projectId={projectId}
            targets={impact.regeneration_targets.filter((t) => inView(t.stage))}
          />
        </YStack>
      ) : null}
    </YStack>
  );
}

// Phase-44(完了後の調整):追記
// 絞り込みの帯(全段階・印のある段階ごとの未確認の数・未確認のみ)。段階のボタンは段階を選び直す
// (作業領域も同じ段階へ移り、パネルはその段階に追従する)。
function ImpactFilter({
  summary,
  selectedStage,
  allStages,
  openOnly,
  onAllStages,
  onStage,
  onOpenOnly,
}: {
  summary: { stage: number; open: number }[];
  selectedStage: number;
  allStages: boolean;
  openOnly: boolean;
  onAllStages: () => void;
  onStage: (stage: number) => void;
  onOpenOnly: (value: boolean) => void;
}) {
  return (
    <XStack gap="$2" alignItems="center" flexWrap="wrap" role="group" aria-label="印の絞り込み">
      <Button size="$2" theme={allStages ? "blue" : undefined} aria-pressed={allStages} onPress={onAllStages}>
        全段階
      </Button>
      {summary.map(({ stage, open }) => {
        const pressed = !allStages && stage === selectedStage;
        return (
          <Button
            key={stage}
            size="$2"
            theme={pressed ? "blue" : undefined}
            aria-pressed={pressed}
            onPress={() => onStage(stage)}
          >
            {open > 0 ? `段階${stage}(未確認 ${open})` : `段階${stage}`}
          </Button>
        );
      })}
      <label style={{ fontSize: 13, display: "inline-flex", gap: 4, alignItems: "center" }}>
        <input type="checkbox" checked={openOnly} onChange={(e) => onOpenOnly(e.target.checked)} />
        未確認のみ
      </label>
    </XStack>
  );
}

// Phase-44(完了後の調整)：更新
// // 変わったもの(全段階の記録を重複なく。承認していない編集の差分は「承認すると届く」と添える)
// ↓↓
// 変わったもの(渡した段階の記録を重複なく。承認していない編集の差分は「承認すると届く」と添える)
function ChangeList({ projectId, stages }: { projectId: string; stages: StageImpactRead[] }) {
  const changes = uniqueChanges(stages);
  if (changes.length === 0) return null;
  return (
    <YStack gap="$2">
      <Text fontWeight="600">変わったもの</Text>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE} aria-label="変わったもの">
          <thead>
            <tr>
              {["変わった場所", "要素", "変化", "前", "後"].map((h) => (
                <th key={h} style={HEAD}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={changeId(c)} style={c.pending ? { opacity: 0.7 } : undefined}>
                <td style={CELL}>
                  {sourceLabel(c.source)}
                  {c.stage === 0 ? (
                    <Link href={`/projects/${projectId}/documents`}>
                      <Text color="$blue10" fontSize="$1">
                        {" "}
                        文書を開く
                      </Text>
                    </Link>
                  ) : null}
                </td>
                <td style={CELL}>
                  <span style={MONO}>{c.key}</span>
                  {c.new_key ? <span style={MONO}>{` → ${c.new_key}`}</span> : null}
                </td>
                <td style={CELL}>
                  {CHANGE_KIND_LABELS[c.change]}
                  {c.pending ? (
                    <Text fontSize="$1" color="$color10">
                      (承認すると届く)
                    </Text>
                  ) : null}
                </td>
                <td style={CELL}>{c.before ?? ""}</td>
                <td style={CELL}>{c.after ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </YStack>
  );
}

const changeId = (c: ElementChangeRead) => `${c.source}|${c.key}|${c.change}|${c.pending}`;

function uniqueChanges(stages: StageImpactRead[]): ElementChangeRead[] {
  const seen = new Map<string, ElementChangeRead>();
  for (const c of stages.flatMap((s) => s.changes)) {
    if (!seen.has(changeId(c))) seen.set(changeId(c), c);
  }
  return [...seen.values()];
}

// 段階1つに届いた印の表
function StageMarks({
  item,
  marks,
  openKeys,
  disabled,
  onReview,
  onShow,
}: {
  item: StageImpactRead;
  marks: ImpactMarkRead[];
  openKeys: string[];
  disabled: boolean;
  onReview: (keys: string[], reviewed: boolean) => void;
  onShow: (key: string) => void;
}) {
  const title = `段階${item.stage} ${STAGE_TITLES[item.stage] ?? ""}`;
  return (
    <YStack gap="$2" aria-label={`${title}の印`}>
      <XStack justifyContent="space-between" alignItems="center" gap="$2" flexWrap="wrap">
        <Text fontWeight="600">{`${title}(見直し ${item.open} / 確認済み ${item.reviewed})`}</Text>
        {openKeys.length > 0 ? (
          <Button size="$2" disabled={disabled} onPress={() => onReview(openKeys, true)}>
            この段階の未確認をすべて確認済みにする
          </Button>
        ) : null}
      </XStack>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE}>
          <thead>
            <tr>
              {["要素", "たどった道", "理由", "変わった場所", "状態", "操作"].map((h) => (
                <th key={h} style={HEAD}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {marks.map((mark) => {
              const status = markStatus(mark);
              return (
                <tr key={mark.key} style={mark.pending ? { opacity: 0.7 } : undefined}>
                  <td style={CELL}>
                    <Text fontSize="$2">{mark.label}</Text>
                    <span style={{ ...MONO, display: "block" }}>{mark.key}</span>
                  </td>
                  <td style={{ ...CELL, ...MONO }}>{pathText(mark.path)}</td>
                  <td style={CELL}>{mark.reason}</td>
                  <td style={CELL}>{mark.sources.map(sourceLabel).join("、")}</td>
                  <td style={CELL}>
                    <ImpactBadge mark={mark} />
                  </td>
                  <td style={CELL}>
                    <XStack gap="$1" flexWrap="wrap">
                      {status === "open" ? (
                        <Button
                          size="$1"
                          disabled={disabled}
                          onPress={() => onReview([mark.key], true)}
                          aria-label={`${mark.key} を確認済みにする`}
                        >
                          確認済みにする
                        </Button>
                      ) : null}
                      {status === "reviewed" ? (
                        <Button
                          size="$1"
                          disabled={disabled}
                          onPress={() => onReview([mark.key], false)}
                          aria-label={`${mark.key} を未確認に戻す`}
                        >
                          未確認に戻す
                        </Button>
                      ) : null}
                      <Button
                        size="$1"
                        onPress={() => onShow(mark.key)}
                        aria-label={`${mark.key} を段階の表で見る`}
                      >
                        表で見る
                      </Button>
                    </XStack>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </YStack>
  );
}
