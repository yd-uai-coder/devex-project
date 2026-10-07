// 作成：Phase-27-3
"use client";

import { useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import {
  FINDING_LEVELS,
  type DesignStageRead,
  type FindingLevel,
} from "@/features/detailed-design/api/types";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import {
  FINDING_LEVEL_LABELS,
  FINDING_SOURCE_LABELS,
  UNIT_KIND_LABELS,
} from "@/features/detailed-design/labels";
import { toPlan } from "@/features/detailed-design/planOps";
import {
  collectFindings,
  countByLevel,
  filterFindings,
  findingsOfUnit,
  procedureUnits,
  toProcedureDoc,
  type Finding,
} from "@/features/detailed-design/procedureDocOps";

// 段階8(実装手順書)の作業領域の中身。段階7の作業単位の一覧(依存順)と、実装可能性チェックの
// 未定義・要決定の一覧を持つ。未定義は手順書の上では決めず、「段階Nで直す」で対象の段階へ移って直す
// (直した段階は差し戻され、段階8は「古い」になる)。

const LEVEL_COLOR: Record<FindingLevel, string> = {
  critical: "var(--red10)",
  major: "var(--orange10)",
  minor: "var(--color10)",
};
const NOWRAP = { ...CELL, whiteSpace: "nowrap" } as const;

function LevelCounts({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return <>なし</>;
  const counts = countByLevel(findings);
  return (
    <>
      {FINDING_LEVELS.filter((level) => counts[level] > 0).map((level) => (
        <span key={level} style={{ color: LEVEL_COLOR[level], marginRight: 6, whiteSpace: "nowrap" }}>
          {FINDING_LEVEL_LABELS[level]} {counts[level]}
        </span>
      ))}
    </>
  );
}

function FindingTable({
  findings,
  onFix,
}: {
  findings: Finding[];
  onFix: (finding: Finding) => void;
}) {
  if (findings.length === 0) return <Text fontSize="$2">未定義・要決定はありません。</Text>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={TABLE} aria-label="未定義・要決定">
        <thead>
          <tr>
            {["重要度", "出どころ", "単位", "対象", "内容", "操作"].map((head) => (
              <th key={head} style={HEAD}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {findings.map((finding, index) => (
            <tr key={`${finding.unit}-${finding.target}-${index}`}>
              <td style={{ ...NOWRAP, color: LEVEL_COLOR[finding.level] }}>
                {FINDING_LEVEL_LABELS[finding.level]}
              </td>
              <td style={NOWRAP}>{FINDING_SOURCE_LABELS[finding.source]}</td>
              <td style={{ ...NOWRAP, ...MONO }}>{finding.unit ?? "全体"}</td>
              <td style={CELL}>{finding.target}</td>
              <td style={CELL}>{finding.message}</td>
              <td style={NOWRAP}>
                {finding.fixStage === 8 ? null : (
                  <Button size="$2" onPress={() => onFix(finding)}>
                    {`段階${finding.fixStage}で直す`}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProcedureDocPanel({ stage }: { stage: DesignStageRead }) {
  const planModel = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 7)?.model ?? null,
  );
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  const [filter, setFilter] = useState<FindingLevel | "all">("all");

  const doc = toProcedureDoc(stage.model);
  const units = procedureUnits(toPlan(planModel), doc);
  const findings = collectFindings(stage.issues, doc);
  const counts = countByLevel(findings);
  // 重要度の無い指摘は、手順書そのもののエラー(形の不正・段階7と合わない手順書)
  const docIssues = stage.issues.filter((issue) => !issue.level);

  return (
    <YStack gap="$4">
      <YStack gap="$2">
        <Text fontWeight="700">単位の一覧(依存順)</Text>
        <Paragraph color="$color11" fontSize="$2">
          段階7の作業単位です(依存は前の単位だけを指すので、計画の並び順が依存順です)。手順書の生成は準備中です。
        </Paragraph>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="単位の一覧">
            <thead>
              <tr>
                {["単位", "種別", "タスク", "処理", "依存", "手順書", "未定義"].map((head) => (
                  <th key={head} style={HEAD}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td style={{ ...NOWRAP, ...MONO }}>{unit.id}</td>
                  <td style={NOWRAP}>{UNIT_KIND_LABELS[unit.kind]}</td>
                  <td style={CELL}>{unit.title}</td>
                  <td style={{ ...CELL, ...MONO }}>{unit.functionIds.join(", ") || "—"}</td>
                  <td style={{ ...CELL, ...MONO }}>{unit.dependsOn.join(", ") || "—"}</td>
                  <td style={NOWRAP}>{unit.hasProcedure ? "生成済" : "未生成"}</td>
                  <td style={CELL}>
                    <LevelCounts findings={findingsOfUnit(findings, unit.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </YStack>

      <YStack gap="$2">
        <Text fontWeight="700">未定義・要決定(実装可能性チェック)</Text>
        <Paragraph color="$color11" fontSize="$2">
          「検証」は設計の ID・パスの突き合わせ、「AI」は手順書を作った AI の指摘です。手順書の上では決めず、対象の段階で直してください。直した段階は差し戻され、この段階は「古い」になります。
        </Paragraph>
        <XStack gap="$2" flexWrap="wrap">
          <Button
            size="$2"
            theme={filter === "all" ? "blue" : undefined}
            aria-pressed={filter === "all"}
            onPress={() => setFilter("all")}
          >
            {`すべて(${findings.length})`}
          </Button>
          {FINDING_LEVELS.map((level) => (
            <Button
              key={level}
              size="$2"
              theme={filter === level ? "blue" : undefined}
              aria-pressed={filter === level}
              onPress={() => setFilter(level)}
            >
              {`${FINDING_LEVEL_LABELS[level]}(${counts[level]})`}
            </Button>
          ))}
        </XStack>
        <FindingTable
          findings={filterFindings(findings, filter)}
          onFix={(finding) => jumpTo(finding.fixStage, finding.target)}
        />
      </YStack>

      <StageIssueList issues={docIssues} />
    </YStack>
  );
}
