// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5
// 注: Phase 28 で大きく書き直したため、旧コードのコメントアウトは要所だけにした(27-3 の版は Phase-27-3 の教材を参照)。
"use client";

// Phase-28-3:追記 ── react.useEffect, ConfirmDialog, StyledButton, MAX_PROCEDURE_DOC_TARGETS, StageSaveBar, useStageGenerationPolling, toggleUnit
// Phase-28-4:追記 ── ProcedureDocModel, UnitProcedureEditor
import { useEffect, useState } from "react";
import { Button, Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
import {
  FINDING_LEVELS,
  MAX_PROCEDURE_DOC_TARGETS,
  type DesignStageRead,
  type FindingLevel,
  type ProcedureDocModel,
} from "@/features/detailed-design/api/types";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { UnitProcedureEditor } from "@/features/detailed-design/components/UnitProcedureEditor";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
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
  toggleUnit,
  toProcedureDoc,
  type Finding,
} from "@/features/detailed-design/procedureDocOps";

// ストアに覚えるタブの選択の鍵(詳細を開いている単位)
const TAB_KEY = "8:unit";

// 段階8(実装手順書)の作業領域の中身。段階7の作業単位の一覧(依存順)、手順書の AI の下書きの生成
// (選んだ単位を1回に5つまで)、単位の詳細(参照する設計の展開と、手順書の編集)、実装可能性チェックの
// 未定義・要決定の一覧を持つ。未定義は手順書の上では決めず、「段階Nで直す」で対象の段階へ移って直す
// (直した段階は差し戻され、段階8は「古い」になる)。編集中の内容はこのコンポーネントの中だけに持ち、
// 保存して初めてサーバーへ送る(段階5の ProcedurePanel と同じ形)。

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

// Phase-28-3：更新(props に projectId・onDirtyChange を足し、生成の状態を持つ)
// export function ProcedureDocPanel({ stage }: { stage: DesignStageRead }) {
// ↓↓
export function ProcedureDocPanel({
  projectId,
  stage,
  onDirtyChange,
}: {
  projectId: string;
  stage: DesignStageRead;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const planModel = useDetailedDesignStore(
    (s) => s.stages.find((item) => item.stage === 7)?.model ?? null,
  );
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore((s) => s.requestingGeneration);
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  const setTab = useDetailedDesignStore((s) => s.setTab);
  const [filter, setFilter] = useState<FindingLevel | "all">("all");

  // Phase-28-4：更新(手順書を編集中の下書きとして持つ)
  // const doc = toProcedureDoc(stage.model);
  // ↓↓
  const saved = toProcedureDoc(stage.model);
  const [doc, setDoc] = useState<ProcedureDocModel>(saved);
  // Phase-28-3:追記
  // 生成する単位の選択(保存しない。生成でパネルが作り直されると空に戻る)
  const [selection, setSelection] = useState<string[]>([]);
  // 作り直しの確認を出しているか(選んだ単位に手順書のあるものが含まれるとき)
  const [confirming, setConfirming] = useState(false);
  // Phase-28-4:追記
  // 詳細を開いている単位。保存・生成でパネルが作り直されても同じ単位に戻す
  const [opened, setOpenedState] = useState<string | null>(
    () => useDetailedDesignStore.getState().tabs[TAB_KEY] ?? null,
  );
  const setOpened = (unitId: string | null) => {
    setOpenedState(unitId);
    setTab(TAB_KEY, unitId);
  };
  // Phase-28-3:追記
  const dirty = JSON.stringify(doc) !== JSON.stringify(saved);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const generating = stage.generation_status === "generating";
  const { timedOut } = useStageGenerationPolling(projectId, generating);
  const canGenerate = stage.is_open && !generating && !requestingGeneration && !dirty;

  const units = procedureUnits(toPlan(planModel), doc);
  // Phase-28-3:追記
  const savedUnits = procedureUnits(toPlan(planModel), saved);
  const regenerating = savedUnits.filter((unit) => unit.hasProcedure && selection.includes(unit.id));
  // Phase-28-4:追記
  const openedUnit = units.find((unit) => unit.id === opened) ?? null;
  const findings = collectFindings(stage.issues, doc);
  const counts = countByLevel(findings);
  // 重要度の無い指摘は、手順書そのもののエラー(形の不正・段階7と合わない手順書)
  const docIssues = stage.issues.filter((issue) => !issue.level);

  // Phase-28-3:追記
  const startGeneration = () => {
    setConfirming(false);
    void generate(projectId, stage.stage, undefined, undefined, selection);
  };
  const saveBar = (
    <StageSaveBar
      dirty={dirty}
      saving={saving}
      disabled={generating || !stage.is_open}
      onSave={() => void save(projectId, stage.stage, doc)}
    />
  );

  return (
    <YStack gap="$4">
      {/* Phase-28-3:追記 */}
      {saveBar}

      <YStack gap="$2">
        <Text fontWeight="700">単位の一覧(依存順)</Text>
        <Paragraph color="$color11" fontSize="$2">
          段階7の作業単位です(依存は前の単位だけを指すので、計画の並び順が依存順です)。手順書を作る単位を選んで生成し、単位の ID を押すと詳細を開きます。
        </Paragraph>
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="単位の一覧">
            <thead>
              <tr>
                {["生成", "単位", "種別", "タスク", "処理", "依存", "手順書", "未定義"].map((head) => (
                  <th key={head} style={HEAD}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr
                  key={unit.id}
                  style={unit.id === opened ? { background: "var(--blue2)" } : undefined}
                >
                  {/* Phase-28-3:追記(生成の選択の列) */}
                  <td style={NOWRAP}>
                    <input
                      type="checkbox"
                      aria-label={`${unit.id} を生成する`}
                      checked={selection.includes(unit.id)}
                      disabled={
                        generating ||
                        !stage.is_open ||
                        (!selection.includes(unit.id) &&
                          selection.length >= MAX_PROCEDURE_DOC_TARGETS)
                      }
                      onChange={() =>
                        setSelection((current) =>
                          toggleUnit(current, unit.id, MAX_PROCEDURE_DOC_TARGETS),
                        )
                      }
                    />
                  </td>
                  {/* Phase-28-4：更新(単位の ID を、詳細を開くボタンにする)
                  <td style={{ ...NOWRAP, ...MONO }}>{unit.id}</td>
                  ↓↓ */}
                  <td style={{ ...NOWRAP, ...MONO }}>
                    <button
                      type="button"
                      style={{ ...MONO, cursor: "pointer", background: "none", border: "none", padding: 0, color: "var(--blue11)", textDecoration: "underline" }}
                      aria-label={`${unit.id} の詳細を開く`}
                      onClick={() => setOpened(unit.id === opened ? null : unit.id)}
                    >
                      {unit.id}
                    </button>
                  </td>
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
        {/* Phase-28-3:追記(生成のボタンと状態) */}
        <XStack gap="$3" alignItems="center" flexWrap="wrap">
          <StyledButton
            disabled={!canGenerate || selection.length === 0}
            onPress={() => (regenerating.length > 0 ? setConfirming(true) : startGeneration())}
          >
            {generating
              ? "生成中"
              : `選んだ単位の手順書を生成する(${selection.length}/${MAX_PROCEDURE_DOC_TARGETS})`}
          </StyledButton>
          <Text color="$color11" fontSize="$2">
            {dirty
              ? "保存してから生成してください(生成は保存した手順書に重ねます)。"
              : "単位が参照する設計から、AI が単位ごとに手順書を下書きします。選ばなかった単位の手順書はそのまま残ります。"}
          </Text>
        </XStack>
        {generating && timedOut ? (
          <Text role="status" color="$color11">
            生成に時間がかかっています。しばらくしてから画面を読み込み直してください。
          </Text>
        ) : null}
        {stage.generation_status === "failed" && stage.generation_error ? (
          <Text role="alert" color="$red10">
            {stage.generation_error}
          </Text>
        ) : null}
      </YStack>

      {/* Phase-28-3:追記 */}
      <ConfirmDialog
        open={confirming}
        title="手順書を作り直しますか?"
        description={
          <>
            AI が {regenerating.map((unit) => unit.id).join("、")} の手順書を作り直します。これらの手順書の手直しは失われます(他の単位の手順書はそのまま残ります)。
            {stage.state === "approved" || stage.state === "outdated"
              ? "段階の承認はやり直しになります。"
              : ""}
          </>
        }
        confirmLabel="作り直す"
        onConfirm={startGeneration}
        onCancel={() => setConfirming(false)}
      />

      {/* Phase-28-4:追記 */}
      {openedUnit ? (
        <YStack padding="$3" borderWidth={1} borderColor="$borderColor" borderRadius="$4">
          <UnitProcedureEditor
            key={openedUnit.id}
            projectId={projectId}
            unit={openedUnit}
            doc={doc}
            disabled={generating || !stage.is_open}
            // Phase-30-5:追記
            unsaved={dirty}
            onChange={setDoc}
            onFix={jumpTo}
          />
        </YStack>
      ) : null}

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

      {/* Phase-28-3:追記 */}
      {saveBar}

      <StageIssueList issues={docIssues} />
    </YStack>
  );
}
