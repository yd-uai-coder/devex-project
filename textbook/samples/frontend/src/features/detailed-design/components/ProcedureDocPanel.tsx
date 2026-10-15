// 作成：Phase-27-3｜更新：Phase-28-3,28-4,30-5,31-5,38-3,38(完了後の調整),44-3,53-5,53(完了後の調整),54-1,57-2
// 注: Phase 28 で大きく書き直したため、旧コードのコメントアウトは要所だけにした(27-3 の版は Phase-27-3 の教材を参照)。
"use client";

// Phase-28-3:追記 ── react.useEffect, ConfirmDialog, StyledButton, MAX_PROCEDURE_DOC_TARGETS, StageSaveBar, useStageGenerationPolling, toggleUnit
// Phase-28-4:追記 ── ProcedureDocModel, UnitProcedureEditor
// Phase-38(完了後の調整):追記 ── @/features/detailed-design/components/StrayProcedureList.StrayProcedureList
// Phase-44-3:追記 ── @/features/detailed-design/components/ImpactBadge.ImpactBadge, @/features/detailed-design/hooks/useStageImpact.useStageImpact, @/features/detailed-design/impactOps.elementKey
// Phase-53-5:追記 ── @/features/design-review/model.unreviewedNotice, @/features/design-review/review-store.useReviewStore
// Phase-53(完了後の調整):追記 ── ReviewFindingBadge(@/features/design-review/components/ReviewFindingBadge), useStageReview(@/features/detailed-design/hooks/useStageReview)
// Phase-54-1:追記 ── @/features/design-review/model.joinNotices, @/features/design-review/model.unaddressedNotice
// Phase-57-2:追記 ── @/features/detailed-design/components/FindingLevelFilter(FindingLevelFilter, FindingFilter), @/features/detailed-design/labels.FINDING_LEVEL_COLORS
// Phase-57-2：削除 ── tamagui.Button, @/features/detailed-design/api/types.FindingLevel(絞り込みのボタンを FindingLevelFilter へ移した)
import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { ConfirmDialog } from "@/components/ui/layout-blocks/ConfirmDialog";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
// Phase-54-1：更新
// import { unreviewedNotice } from "@/features/design-review/model";
// ↓↓
import { joinNotices, unaddressedNotice, unreviewedNotice } from "@/features/design-review/model";
import { useReviewStore } from "@/features/design-review/review-store";
import {
  FINDING_LEVELS,
  MAX_PROCEDURE_DOC_TARGETS,
  type DesignStageRead,
  type ProcedureDocModel,
} from "@/features/detailed-design/api/types";
// Phase-31-5:追記
import { FindingLevelFilter, type FindingFilter } from "@/features/detailed-design/components/FindingLevelFilter";
import { FixTargetButton } from "@/features/detailed-design/components/FixTargetButton";
import { ReviewFindingBadge } from "@/features/design-review/components/ReviewFindingBadge";
import { ImpactBadge } from "@/features/detailed-design/components/ImpactBadge";
import { StageIssueList } from "@/features/detailed-design/components/StageIssueList";
import { StageSaveBar } from "@/features/detailed-design/components/StageSaveBar";
import { StrayProcedureList } from "@/features/detailed-design/components/StrayProcedureList";
import { CELL, HEAD, MONO, TABLE } from "@/features/detailed-design/components/tableStyles";
import { UnitProcedureEditor } from "@/features/detailed-design/components/UnitProcedureEditor";
import { useDetailedDesignStore } from "@/features/detailed-design/detailed-design-store";
import { useStageGenerationPolling } from "@/features/detailed-design/hooks/useStageGenerationPolling";
import { useStageImpact } from "@/features/detailed-design/hooks/useStageImpact";
import { useStageReview } from "@/features/detailed-design/hooks/useStageReview";
import { elementKey } from "@/features/detailed-design/impactOps";
import {
  FINDING_LEVEL_COLORS,
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
  // Phase-31-5:追記
  fixTarget,
  procedureUnits,
  toggleUnit,
  toProcedureDoc,
  type Finding,
} from "@/features/detailed-design/procedureDocOps";

// ストアに覚えるタブの選択の鍵(詳細を開いている単位)
const TAB_KEY = "8:unit";

// Phase-31-5：更新
// // 段階8(実装手順書)の作業領域の中身。段階7の作業単位の一覧(依存順)、手順書の AI の下書きの生成
// ↓↓
// 段階8(実装手順書)の作業領域の中身。作業単位の一覧(依存順)、手順書の AI の下書きの生成
// (選んだ単位を1回に5つまで)、単位の詳細(参照する設計の展開と、手順書の編集)、実装可能性チェックの
// 未定義・要決定の一覧を持つ。未定義は手順書の上では決めず、「段階Nで直す」で対象の段階へ移って直す
// (直した段階は差し戻され、段階8は「古い」になる)。編集中の内容はこのコンポーネントの中だけに持ち、
// 保存して初めてサーバーへ送る(段階5の ProcedurePanel と同じ形)。
// Phase-31-5:追記
// 作業単位は段階8の plan(詳細設計モードは段階7、簡易モードは実装計画書の WBS)から読む。簡易モードは
// 直す先が文書なので、「〇〇書を直す(再生成)」で文書の画面へ移る。

// Phase-57-2：削除
// const LEVEL_COLOR: Record<FindingLevel, string> = {
//   critical: "var(--red10)",
//   major: "var(--orange10)",
//   minor: "var(--color10)",
// };
const NOWRAP = { ...CELL, whiteSpace: "nowrap" } as const;

function LevelCounts({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return <>なし</>;
  const counts = countByLevel(findings);
  return (
    <>
      {FINDING_LEVELS.filter((level) => counts[level] > 0).map((level) => (
        // Phase-57-2：更新
        // <span key={level} style={{ color: LEVEL_COLOR[level], marginRight: 6, whiteSpace: "nowrap" }}>
        // ↓↓
        <span key={level} style={{ color: FINDING_LEVEL_COLORS[level], marginRight: 6, whiteSpace: "nowrap" }}>
          {FINDING_LEVEL_LABELS[level]} {counts[level]}
        </span>
      ))}
    </>
  );
}

function FindingTable({
  // Phase-31-5:追記
  projectId,
  findings,
  onFix,
}: {
  // Phase-31-5:追記
  projectId: string;
  findings: Finding[];
  // Phase-31-5：更新
  // onFix: (finding: Finding) => void;
  // ↓↓
  onFix: (stage: number, target: string) => void;
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
              {/* Phase-57-2：更新
              <td style={{ ...NOWRAP, color: LEVEL_COLOR[finding.level] }}>
              ↓↓ */}
              <td style={{ ...NOWRAP, color: FINDING_LEVEL_COLORS[finding.level] }}>
                {FINDING_LEVEL_LABELS[finding.level]}
              </td>
              <td style={NOWRAP}>{FINDING_SOURCE_LABELS[finding.source]}</td>
              <td style={{ ...NOWRAP, ...MONO }}>{finding.unit ?? "全体"}</td>
              <td style={CELL}>{finding.target}</td>
              <td style={CELL}>{finding.message}</td>
              <td style={NOWRAP}>
                {/* Phase-31-5：更新
                   {finding.fixStage === 8 ? null : (
                   <Button size="$2" onPress={() => onFix(finding)}>
                   {`段階${finding.fixStage}で直す`}
                   </Button>
                   )}
                   ↓↓ */}
                <FixTargetButton
                  projectId={projectId}
                  target={fixTarget(finding.fixStage, finding.fixDocument)}
                  onStage={(stage) => onFix(stage, finding.target)}
                />
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
  // Phase-31-5：更新
  // const planModel = useDetailedDesignStore(
  //   (s) => s.stages.find((item) => item.stage === 7)?.model ?? null,
  // );
  // ↓↓
  const planModel = stage.plan;
  const simple = stage.mode === "simple";
  const saving = useDetailedDesignStore((s) => s.saving);
  const requestingGeneration = useDetailedDesignStore((s) => s.requestingGeneration);
  const save = useDetailedDesignStore((s) => s.save);
  const generate = useDetailedDesignStore((s) => s.generate);
  const jumpTo = useDetailedDesignStore((s) => s.jumpTo);
  // Phase-44-3:追記
  const impact = useStageImpact(stage.stage);
  // Phase-53(完了後の調整):追記
  const review = useStageReview(stage.stage);
  const setTab = useDetailedDesignStore((s) => s.setTab);
  // Phase-57-2：更新
  // const [filter, setFilter] = useState<FindingLevel | "all">("all");
  // ↓↓
  const [filter, setFilter] = useState<FindingFilter>("all");

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
  // Phase-53-5:追記
  // Phase-54-1：更新
  // // 生成を始めたときの、未レビューの区切りの知らせ(止めはしない)
  // ↓↓
  // 生成を始めたときの、採用したまま直していない指摘・未レビューの区切りの知らせ(止めはしない)
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const reviewEffective = useReviewStore((s) => s.me?.review_effective ?? false);
  const reviewGates = useReviewStore((s) => s.gates);
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
  // Phase-38-3:追記
  const unitReqIds = stage.unit_req_ids ?? {};

  // Phase-28-3:追記
  const startGeneration = () => {
    setConfirming(false);
    // Phase-53-5:追記
    // Phase-54-1：更新
    // setReviewNotice(reviewEffective ? unreviewedNotice(reviewGates) : null);
    // ↓↓
    setReviewNotice(reviewEffective ? joinNotices(unaddressedNotice(reviewGates), unreviewedNotice(reviewGates)) : null);
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
          {/* Phase-31-5：更新
             段階7の作業単位です(依存は前の単位だけを指すので、計画の並び順が依存順です)。手順書を作る単位を選んで生成し、単位の ID を押すと詳細を開きます。
             ↓↓ */}
          {simple ? "実装計画書の WBS" : "段階7"}の作業単位です(依存は前の単位だけを指すので、計画の並び順が依存順です)。手順書を作る単位を選んで生成し、単位の ID を押すと詳細を開きます。
        </Paragraph>
        {/* Phase-31-5:追記 */}
        {simple && units.length === 0 ? (
          <Text role="status" color="$orange10">
            実装計画書の WBS から作業単位を読めませんでした。下の指摘を見て、文書を再生成してください。
          </Text>
        ) : null}
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE} aria-label="単位の一覧">
            <thead>
              <tr>
                {/* Phase-38-3：更新
                {["生成", "単位", "種別", "タスク", "処理", "依存", "手順書", "未定義"].map((head) => (
                ↓↓ */}
                {["生成", "単位", "種別", "タスク", "処理", "要件", "依存", "手順書", "未定義"].map((head) => (
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
                  // Phase-44-3：更新
                  // style={unit.id === opened ? { background: "var(--blue2)" } : undefined}
                  // ↓↓
                  {...impact.row(elementKey.unit(unit.key))}
                  style={
                    impact.row(elementKey.unit(unit.key)).style ??
                    (unit.id === opened ? { background: "var(--blue2)" } : undefined)
                  }
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
                    {/* Phase-44-3:追記 */}
                    <ImpactBadge mark={impact.mark(elementKey.unit(unit.key))} />
                    {/* Phase-53(完了後の調整):追記 */}
                    <ReviewFindingBadge projectId={review.projectId} items={review.findings(elementKey.unit(unit.key))} />
                  </td>
                  <td style={NOWRAP}>{UNIT_KIND_LABELS[unit.kind]}</td>
                  <td style={CELL}>{unit.title}</td>
                  <td style={{ ...CELL, ...MONO }}>{unit.functionIds.join(", ") || "—"}</td>
                  {/* Phase-38-3:追記 */}
                  <td style={{ ...CELL, ...MONO }}>{(unitReqIds[unit.id] ?? []).join(", ") || "—"}</td>
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
        {/* Phase-53-5:追記 */}
        {reviewNotice ? (
          <Text role="status" color="$orange10" fontSize="$2">
            {reviewNotice}
          </Text>
        ) : null}
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
      {/* Phase-38(完了後の調整):追記 */}
      <StrayProcedureList
        plan={toPlan(planModel)}
        doc={doc}
        planLabel={simple ? "実装計画書" : "段階7"}
        disabled={generating || !stage.is_open}
        onChange={setDoc}
      />

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
            // Phase-31-5:追記
            mode={stage.mode}
            onChange={setDoc}
            onFix={jumpTo}
          />
        </YStack>
      ) : null}

      <YStack gap="$2">
        <Text fontWeight="700">未定義・要決定(実装可能性チェック)</Text>
        <Paragraph color="$color11" fontSize="$2">
          {/* Phase-31-5：更新
             「検証」は設計の ID・パスの突き合わせ、「AI」は手順書を作った AI の指摘です。手順書の上では決めず、対象の段階で直してください。直した段階は差し戻され、この段階は「古い」になります。
             ↓↓ */}
          {simple
            ? "「検証」は実装計画書・内部設計書の ID・パスの突き合わせ、「AI」は手順書を作った AI の指摘です。手順書の上では決めず、直す先の文書を再生成して直してください(手順が要る単位は、詳細設計モードで詰めることも検討してください)。文書を再生成すると、この段階は「古い」になります。"
            : "「検証」は設計の ID・パスの突き合わせ、「AI」は手順書を作った AI の指摘です。手順書の上では決めず、対象の段階で直してください。直した段階は差し戻され、この段階は「古い」になります。"}
        </Paragraph>
        {/* Phase-57-2：更新
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
        ↓↓ */}
        <FindingLevelFilter filter={filter} counts={counts} onChange={setFilter} />
        <FindingTable
          // Phase-31-5:追記
          projectId={projectId}
          findings={filterFindings(findings, filter)}
          // Phase-31-5：更新
          // onFix={(finding) => jumpTo(finding.fixStage, finding.target)}
          // ↓↓
          onFix={jumpTo}
        />
      </YStack>

      {/* Phase-28-3:追記 */}
      {saveBar}

      <StageIssueList issues={docIssues} />
    </YStack>
  );
}
