// 作成：Phase-28-4｜更新：Phase-29-5,30-5,31-5
"use client";

// Phase-29-5:追記 ── @/features/detailed-design/components/ProcedureSequenceView.SequenceSvg
import { useEffect, useState } from "react";
import { Paragraph, Text, XStack, YStack } from "tamagui";
import { StyledButton } from "@/components/ui/primitives/StyledButton";
// Phase-30-5：更新
// import { getUnitContext } from "@/features/detailed-design/api/designStagesApi";
// ↓↓
import { getUnitAiMarkdown, getUnitContext } from "@/features/detailed-design/api/designStagesApi";
import {
  FINDING_LEVELS,
  // Phase-31-5:追記
  type DesignDocument,
  type FindingLevel,
  type ProcedureDocModel,
  // Phase-31-5:追記
  type ProjectMode,
  type UnitContextRead,
} from "@/features/detailed-design/api/types";
// Phase-31-5:追記
import { FixTargetButton } from "@/features/detailed-design/components/FixTargetButton";
import { SequenceSvg } from "@/features/detailed-design/components/ProcedureSequenceView";
import {
  BADGE,
  CELL,
  HEAD,
  INPUT,
  MONO,
  OPTION,
  TABLE,
} from "@/features/detailed-design/components/tableStyles";
import {
  // Phase-31-5:追記
  DESIGN_DOCUMENT_LABELS,
  FINDING_LEVEL_LABELS,
  UNIT_FILE_KIND_LABELS,
  UNIT_KIND_LABELS,
} from "@/features/detailed-design/labels";
import { subToText, textToSub } from "@/features/detailed-design/logicOps";
import {
  // Phase-31-5:追記
  DESIGN_DOCUMENTS,
  FILE_KINDS,
  addUnitRow,
  // Phase-30-5:追記
  aiCopyNotices,
  // Phase-31-5:追記
  fixTarget,
  removeUnit,
  removeUnitRow,
  updateUnit,
  updateUnitRow,
  type ProcedureUnit,
} from "@/features/detailed-design/procedureDocOps";

// 段階8の、1つの作業単位の詳細。参照する設計(サーバーが承認済みの設計から展開したもの)と、
// 手順書(目的・ファイル・実装の要点・テスト観点・確認方法・AI の指摘)を出す。手順書の編集は
// onChange で呼び出し元(ProcedureDocPanel)へ返し、保存は呼び出し元が行う。AI の指摘は手順書の上では
// Phase-31-5：更新
// // 決めず、「段階Nで直す」で対象の段階へ移って直す(直したら指摘の行を消せる)。
// ↓↓
// 決めず、「段階Nで直す」で対象の段階へ移って直す(直したら指摘の行を消せる)。簡易モードは直す先が
// 文書で、文書の画面へ移って再生成する。
// Phase-30-5:追記
// 「AI 向けにコピー」は、サーバーが保存済みの手順書から組み立てた md を写す。

const TEXTAREA = { ...INPUT, minHeight: 32, resize: "vertical" } as const;

type ContextState =
  | { status: "loading" }
  | { status: "success"; context: UnitContextRead }
  | { status: "error"; message: string };

// 1行に1項目の入力欄(実装の要点・Given/When/Then・確認方法)
function LinesInput({
  label,
  items,
  disabled,
  onChange,
}: {
  label: string;
  items: string[];
  disabled: boolean;
  onChange: (items: string[]) => void;
}) {
  return (
    <YStack gap="$1">
      <Text fontWeight="700">{label}</Text>
      <textarea
        style={{ ...TEXTAREA, minHeight: 56 }}
        aria-label={label}
        placeholder="1行に1つ"
        value={subToText(items)}
        disabled={disabled}
        onChange={(e) => onChange(textToSub(e.target.value))}
      />
    </YStack>
  );
}

// Phase-29-5：更新
// // 参照する設計のバッジ。押すと展開した md を出す。設計に無い参照は赤で、押せない。
// ↓↓
// Phase-31-5:追記
// 共通の節のバッジの名前(詳細設計モードは段階7の 07章・開発環境、簡易モードは内部設計書 3.4節と、
// 実装計画書 4.3節・内部設計書 3.1節)
const COMMON_LABELS: Record<ProjectMode, { crosscutting: string; environment: string }> = {
  detailed: { crosscutting: "07章 横断事項", environment: "段階7 開発環境" },
  simple: { crosscutting: "内部設計書 3.4", environment: "開発環境・技術スタック" },
};

// 参照する設計のバッジ。押すと展開した md を出す(段階5の手順は、シーケンス図の SVG を md の上に出す)。
// 設計に無い参照は赤で、押せない。
// Phase-31-5：更新
// function UnitRefs({ projectId, unitId }: { projectId: string; unitId: string }) {
// ↓↓
function UnitRefs({
  projectId,
  unitId,
  mode,
}: {
  projectId: string;
  unitId: string;
  mode: ProjectMode;
}) {
  const [state, setState] = useState<ContextState>({ status: "loading" });
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getUnitContext(projectId, unitId)
      .then((context) => alive && setState({ status: "success", context }))
      .catch(
        (err: unknown) =>
          alive &&
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "参照の取得に失敗しました",
          }),
      );
    return () => {
      alive = false;
    };
  }, [projectId, unitId]);

  if (state.status === "loading") return <Text color="$color11">参照する設計を読み込み中...</Text>;
  if (state.status === "error")
    return (
      <Text role="alert" color="$red10">
        {state.message}
      </Text>
    );

  const { context } = state;
  const sections = [
    // Phase-29-5：更新
    // ...context.refs.map((ref) => ({ id: `${ref.kind}:${ref.key}`, label: ref.label, md: ref.markdown })),
    // ...(context.crosscutting ? [{ id: "crosscutting", label: "07章 横断事項", md: context.crosscutting }] : []),
    // ...(context.environment ? [{ id: "environment", label: "段階7 開発環境", md: context.environment }] : []),
    // ↓↓
    ...context.refs.map((ref) => ({
      id: `${ref.kind}:${ref.key}`,
      label: ref.label,
      md: ref.markdown,
      svg: ref.svg,
    })),
    ...(context.crosscutting
      // Phase-31-5：更新
      // ? [{ id: "crosscutting", label: "07章 横断事項", md: context.crosscutting, svg: null }]
      // ↓↓
      ? [
          {
            id: "crosscutting",
            label: COMMON_LABELS[mode].crosscutting,
            md: context.crosscutting,
            svg: null,
          },
        ]
      : []),
    ...(context.environment
      // Phase-31-5：更新
      // ? [{ id: "environment", label: "段階7 開発環境", md: context.environment, svg: null }]
      // ↓↓
      ? [
          {
            id: "environment",
            label: COMMON_LABELS[mode].environment,
            md: context.environment,
            svg: null,
          },
        ]
      : []),
  ];
  const expanded = sections.find((section) => section.id === open && section.md !== null);

  return (
    <YStack gap="$2">
      <XStack gap="$1" flexWrap="wrap" alignItems="center">
        {sections.length === 0 ? <Text color="$color11">参照する設計はありません。</Text> : null}
        {sections.map((section) =>
          section.md === null ? (
            <span
              key={section.id}
              style={{ ...BADGE, borderColor: "var(--red8)", color: "var(--red11)", background: "var(--red2)" }}
              title="設計にありません"
            >
              {section.label}(設計に無い)
            </span>
          ) : (
            <button
              key={section.id}
              type="button"
              style={{ ...BADGE, cursor: "pointer" }}
              aria-pressed={open === section.id}
              onClick={() => setOpen(open === section.id ? null : section.id)}
            >
              {section.label}
            </button>
          ),
        )}
      </XStack>
      {/* Phase-29-5:追記 */}
      {expanded?.svg ? (
        <SequenceSvg svg={expanded.svg} label={`${expanded.label} のシーケンス図`} />
      ) : null}
      {expanded ? (
        <pre
          aria-label={`${expanded.label} の展開`}
          style={{ ...MONO, whiteSpace: "pre-wrap", margin: 0, padding: 8, background: "var(--color2)", color: "var(--color)" }}
        >
          {expanded.md}
        </pre>
      ) : null}
    </YStack>
  );
}

// Phase-30-5:追記
type CopyState =
  | { status: "idle" }
  | { status: "copying" }
  | { status: "copied"; notices: string[] }
  | { status: "error"; message: string };

// 「AI 向けにコピー」。サーバーが保存済みの手順書と承認済みの設計から組み立てた md(参照する設計を
// 展開したもの。zip の ai/<単位ID>.md と同じ)をクリップボードへ写す。段階8が承認済みでない・未定義が
// 残るときは、写した後に件数を示して警告する(渡すのは止めない)。保存していない編集があると、写す
// 中身が画面とずれるので押せない。
function AiCopyButton({
  projectId,
  unitId,
  unsaved,
}: {
  projectId: string;
  unitId: string;
  unsaved: boolean;
}) {
  const [state, setState] = useState<CopyState>({ status: "idle" });

  const handleCopy = async () => {
    setState({ status: "copying" });
    try {
      const result = await getUnitAiMarkdown(projectId, unitId);
      await navigator.clipboard.writeText(result.markdown);
      setState({ status: "copied", notices: aiCopyNotices(result) });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "コピーに失敗しました",
      });
    }
  };

  return (
    <YStack gap="$1">
      <XStack gap="$2" alignItems="center" flexWrap="wrap">
        <StyledButton
          size="$2"
          disabled={unsaved || state.status === "copying"}
          onPress={() => void handleCopy()}
        >
          {state.status === "copying" ? "準備中..." : "AI 向けにコピー"}
        </StyledButton>
        <Text color="$color11" fontSize="$2">
          {unsaved
            ? "保存していない編集があります。保存してからコピーしてください。"
            : "参照する設計を展開した md を、AI Coding Agent に渡す形でコピーします(保存済みの内容から)。"}
        </Text>
      </XStack>
      {state.status === "copied" ? (
        <YStack role="status" gap="$1">
          <Text color="$green10" fontSize="$2">
            コピーしました。
          </Text>
          {state.notices.map((notice) => (
            <Text key={notice} color="$orange10" fontSize="$2">
              ⚠ {notice}
            </Text>
          ))}
        </YStack>
      ) : null}
      {state.status === "error" ? (
        <Text role="alert" color="$red10" fontSize="$2">
          {state.message}
        </Text>
      ) : null}
    </YStack>
  );
}

export function UnitProcedureEditor({
  projectId,
  unit,
  doc,
  disabled,
  // Phase-30-5:追記
  unsaved,
  // Phase-31-5:追記
  mode = "detailed",
  onChange,
  onFix,
}: {
  projectId: string;
  unit: ProcedureUnit;
  doc: ProcedureDocModel;
  disabled: boolean;
  // Phase-30-5:追記
  unsaved: boolean;
  // Phase-31-5:追記
  mode?: ProjectMode;
  onChange: (doc: ProcedureDocModel) => void;
  onFix: (fixStage: number, target: string) => void;
}) {
  // Phase-31-5:追記
  const simple = mode === "simple";
  const procedure = doc.units.find((item) => item.unit_id === unit.id) ?? null;
  const mismatched = procedure !== null && procedure.title.trim() !== unit.title.trim();
  const id = unit.id;

  return (
    <YStack gap="$3" aria-label={`${id} の手順書`}>
      <YStack gap="$1">
        <Text fontWeight="700">
          <span style={MONO}>{id}</span> {unit.title}
        </Text>
        <Text color="$color11" fontSize="$2">
          種別: {UNIT_KIND_LABELS[unit.kind]} / マイルストーン: {unit.milestone} / 処理:{" "}
          {unit.functionIds.join(", ") || "なし"} / 依存: {unit.dependsOn.join(", ") || "なし"}
        </Text>
      </YStack>

      <YStack gap="$1">
        <Text fontWeight="700">参照する設計</Text>
        {/* Phase-31-5：更新
           <UnitRefs projectId={projectId} unitId={id} />
           ↓↓ */}
        <UnitRefs projectId={projectId} unitId={id} mode={mode} />
      </YStack>

      {procedure === null ? (
        <Paragraph color="$color11">
          この単位の手順書はまだありません。単位の一覧で選んで生成してください。
        </Paragraph>
      ) : (
        <>
          {mismatched ? (
            <Paragraph role="status" color="$red10">
              {/* Phase-31-5：更新
                 この手順書は、作ったときのタスク名「{procedure.title}」が段階7と合いません。作り直すか、削除してください。
                 ↓↓ */}
              この手順書は、作ったときのタスク名「{procedure.title}」が{simple ? "実装計画書" : "段階7"}と合いません。作り直すか、削除してください。
            </Paragraph>
          // Phase-30-5：更新
          // ) : null}
          // ↓↓
          ) : (
            <AiCopyButton projectId={projectId} unitId={id} unsaved={unsaved} />
          )}

          <YStack gap="$1">
            <Text fontWeight="700">目的</Text>
            <textarea
              style={TEXTAREA}
              aria-label="目的"
              value={procedure.purpose}
              disabled={disabled}
              onChange={(e) => onChange(updateUnit(doc, id, { purpose: e.target.value }))}
            />
          </YStack>

          <YStack gap="$1">
            <Text fontWeight="700">作成・変更するファイル(依存順)</Text>
            <div style={{ overflowX: "auto" }}>
              <table style={TABLE} aria-label="作成・変更するファイル">
                <thead>
                  <tr>
                    {["ファイル", "種類", "責務", "根拠", ""].map((head) => (
                      <th key={head} style={HEAD}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {procedure.files.map((file, index) => (
                    <tr key={index}>
                      <td style={CELL}>
                        <input
                          style={{ ...INPUT, ...MONO }}
                          aria-label={`ファイル ${index + 1} のパス`}
                          value={file.path}
                          disabled={disabled}
                          onChange={(e) => onChange(updateUnitRow(doc, id, "files", index, { path: e.target.value }))}
                        />
                      </td>
                      <td style={CELL}>
                        <select
                          style={INPUT}
                          aria-label={`ファイル ${index + 1} の種類`}
                          value={file.kind}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(
                              updateUnitRow(doc, id, "files", index, {
                                kind: e.target.value as (typeof FILE_KINDS)[number],
                              }),
                            )
                          }
                        >
                          {FILE_KINDS.map((kind) => (
                            <option key={kind} value={kind} style={OPTION}>
                              {UNIT_FILE_KIND_LABELS[kind]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={CELL}>
                        <input
                          style={INPUT}
                          aria-label={`ファイル ${index + 1} の責務`}
                          value={file.responsibility}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(updateUnitRow(doc, id, "files", index, { responsibility: e.target.value }))
                          }
                        />
                      </td>
                      <td style={CELL}>
                        <input
                          style={INPUT}
                          aria-label={`ファイル ${index + 1} の根拠`}
                          value={file.basis}
                          disabled={disabled}
                          onChange={(e) => onChange(updateUnitRow(doc, id, "files", index, { basis: e.target.value }))}
                        />
                      </td>
                      <td style={CELL}>
                        <button
                          type="button"
                          aria-label={`ファイル ${index + 1} を削除`}
                          disabled={disabled}
                          onClick={() => onChange(removeUnitRow(doc, id, "files", index))}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <YStack alignItems="flex-start">
              <StyledButton theme="gray" size="$2" disabled={disabled} onPress={() => onChange(addUnitRow(doc, id, "files"))}>
                ファイルを足す
              </StyledButton>
            </YStack>
          </YStack>

          <LinesInput
            label="実装の要点(設計に書いていないことだけ)"
            items={procedure.notes}
            disabled={disabled}
            onChange={(notes) => onChange(updateUnit(doc, id, { notes }))}
          />

          <YStack gap="$1">
            <Text fontWeight="700">テスト観点</Text>
            <div style={{ overflowX: "auto" }}>
              <table style={TABLE} aria-label="テスト観点">
                <thead>
                  <tr>
                    {["観点", "SUT", "ドライバ", "スタブ", ""].map((head) => (
                      <th key={head} style={HEAD}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {procedure.tests.map((test, index) => (
                    <tr key={index}>
                      {(["viewpoint", "sut", "driver", "stub"] as const).map((field) => (
                        <td key={field} style={CELL}>
                          <textarea
                            style={TEXTAREA}
                            aria-label={`テスト観点 ${index + 1} の${{ viewpoint: "観点", sut: "SUT", driver: "ドライバ", stub: "スタブ" }[field]}`}
                            value={test[field]}
                            disabled={disabled}
                            onChange={(e) =>
                              onChange(updateUnitRow(doc, id, "tests", index, { [field]: e.target.value }))
                            }
                          />
                        </td>
                      ))}
                      <td style={CELL}>
                        <button
                          type="button"
                          aria-label={`テスト観点 ${index + 1} を削除`}
                          disabled={disabled}
                          onClick={() => onChange(removeUnitRow(doc, id, "tests", index))}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <YStack alignItems="flex-start">
              <StyledButton theme="gray" size="$2" disabled={disabled} onPress={() => onChange(addUnitRow(doc, id, "tests"))}>
                テスト観点を足す
              </StyledButton>
            </YStack>
          </YStack>

          <LinesInput
            label="Given / When / Then"
            items={procedure.gwt}
            disabled={disabled}
            onChange={(gwt) => onChange(updateUnit(doc, id, { gwt }))}
          />
          <LinesInput
            label="確認方法"
            items={procedure.verify}
            disabled={disabled}
            onChange={(verify) => onChange(updateUnit(doc, id, { verify }))}
          />

          <YStack gap="$1">
            <Text fontWeight="700">AI の指摘(未定義・要決定)</Text>
            <Paragraph color="$color11" fontSize="$2">
              {/* Phase-31-5：更新
                 手順書の上では決めず、対象の段階で直してください。直したら、この行を消せます。
                 ↓↓ */}
              {simple
                ? "手順書の上では決めず、直す先の文書を再生成して直してください。直したら、この行を消せます。"
                : "手順書の上では決めず、対象の段階で直してください。直したら、この行を消せます。"}
            </Paragraph>
            <div style={{ overflowX: "auto" }}>
              <table style={TABLE} aria-label="AI の指摘">
                <thead>
                  <tr>
                    {/* Phase-31-5：更新
                       {["重要度", "対象", "内容", "直す段階", ""].map((head) => (
                       ↓↓ */}
                    {["重要度", "対象", "内容", simple ? "直す先" : "直す段階", ""].map((head) => (
                      <th key={head} style={HEAD}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {procedure.findings.map((finding, index) => (
                    <tr key={index}>
                      <td style={CELL}>
                        <select
                          style={INPUT}
                          aria-label={`指摘 ${index + 1} の重要度`}
                          value={finding.level}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(
                              updateUnitRow(doc, id, "findings", index, { level: e.target.value as FindingLevel }),
                            )
                          }
                        >
                          {FINDING_LEVELS.map((level) => (
                            <option key={level} value={level} style={OPTION}>
                              {FINDING_LEVEL_LABELS[level]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={CELL}>
                        <input
                          style={INPUT}
                          aria-label={`指摘 ${index + 1} の対象`}
                          value={finding.target}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(updateUnitRow(doc, id, "findings", index, { target: e.target.value }))
                          }
                        />
                      </td>
                      <td style={CELL}>
                        <textarea
                          style={TEXTAREA}
                          aria-label={`指摘 ${index + 1} の内容`}
                          value={finding.message}
                          disabled={disabled}
                          onChange={(e) =>
                            onChange(updateUnitRow(doc, id, "findings", index, { message: e.target.value }))
                          }
                        />
                      </td>
                      <td style={CELL}>
                        {/* Phase-31-5：更新(簡易モードは、直す段階の代わりに直す先の文書を選ぶ。詳細設計モードの select は下の : の側にそのまま残した) */}
                        {simple ? (
                          <select
                            style={INPUT}
                            aria-label={`指摘 ${index + 1} の直す先`}
                            value={finding.fix_document ?? ""}
                            disabled={disabled}
                            onChange={(e) =>
                              onChange(
                                updateUnitRow(doc, id, "findings", index, {
                                  fix_stage: 8,
                                  fix_document: (e.target.value || null) as DesignDocument | null,
                                }),
                              )
                            }
                          >
                            <option value="" style={OPTION}>
                              手順書
                            </option>
                            {DESIGN_DOCUMENTS.map((document) => (
                              <option key={document} value={document} style={OPTION}>
                                {DESIGN_DOCUMENT_LABELS[document]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            style={INPUT}
                            aria-label={`指摘 ${index + 1} の直す段階`}
                            value={finding.fix_stage}
                            disabled={disabled}
                            onChange={(e) =>
                              onChange(
                                updateUnitRow(doc, id, "findings", index, { fix_stage: Number(e.target.value) }),
                              )
                            }
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                              <option key={n} value={n} style={OPTION}>
                                {n === 8 ? "手順書" : `段階${n}`}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td style={{ ...CELL, whiteSpace: "nowrap" }}>
                        {/* Phase-31-5：更新
                           {finding.fix_stage === 8 ? null : (
                           <button type="button" onClick={() => onFix(finding.fix_stage, finding.target)}>
                           {`段階${finding.fix_stage}で直す`}
                           </button>
                           )}
                           ↓↓ */}
                        <FixTargetButton
                          projectId={projectId}
                          target={fixTarget(finding.fix_stage, finding.fix_document)}
                          onStage={(stage) => onFix(stage, finding.target)}
                        />
                        <button
                          type="button"
                          aria-label={`指摘 ${index + 1} を削除`}
                          disabled={disabled}
                          onClick={() => onChange(removeUnitRow(doc, id, "findings", index))}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <YStack alignItems="flex-start">
              <StyledButton
                theme="gray"
                size="$2"
                disabled={disabled}
                onPress={() => onChange(addUnitRow(doc, id, "findings"))}
              >
                指摘を足す
              </StyledButton>
            </YStack>
          </YStack>

          <YStack alignItems="flex-start">
            <StyledButton theme="red" disabled={disabled} onPress={() => onChange(removeUnit(doc, id))}>
              この単位の手順書を削除
            </StyledButton>
          </YStack>
        </>
      )}
    </YStack>
  );
}
