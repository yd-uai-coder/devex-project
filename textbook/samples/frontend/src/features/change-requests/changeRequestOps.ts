// 作成：Phase-87-1｜更新：Phase-87-3,87-4,88-2,88(完了後の調整)
import type {
  BackgroundSource,
  ChangeRequestAction,
  ChangeRequestCreate,
  ChangeRequestRead,
  ChangeRequestStatus,
  ChangeRequestTargetIn,
  ChangeRequestUpdate,
  ComparedItemRead,
  ComparisonStatus,
  // Phase-88-2:追記
  ExplanationSummaryRead,
  SummaryState,
  TargetKind,
} from "@/features/change-requests/api/types";
// Phase-88(完了後の調整):追記
import { ApiError } from "@/lib/api/client";
import type { DesignImpactRead } from "@/features/detailed-design/api/types";
import { STAGE_TITLES } from "@/features/detailed-design/labels";

// 変更要求(CR)の画面の純粋な変換(docs/external_design.md 2.14節)。ラベルの多くはサーバーが
// `*_label` で返すので、ここは画面だけが持つもの(入力の選択肢・ボタン・色・フォーム)に限る。

export const BACKGROUND_SOURCE_OPTIONS: { value: BackgroundSource; label: string }[] = [
  { value: "meeting", label: "打ち合わせ" },
  { value: "email", label: "メール" },
  { value: "document", label: "資料" },
  { value: "other", label: "その他" },
];

export const TARGET_KIND_OPTIONS: { value: TargetKind; label: string }[] = [
  { value: "content", label: "内容の変更" },
  { value: "delete", label: "削除" },
];

// Phase-87-3:追記
// 状態の名前(たどる記録の行の前後の状態。CR そのものの状態はサーバーの status_label を使う)
export const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  draft: "下書き",
  explained: "説明済み",
  agreed: "合意",
  rejected: "却下",
  applied: "反映済み",
  verified: "検証済み",
  withdrawn: "取り下げ",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status as ChangeRequestStatus] ?? status;
}

// ── ここから Phase-87-1 の作成分 ──
// 状態のバッジの色の系統(Tamagui のテーマの色の名前)
export const STATUS_TONE: Record<ChangeRequestStatus, string> = {
  draft: "gray",
  explained: "blue",
  agreed: "green",
  rejected: "red",
  applied: "orange",
  verified: "purple",
  withdrawn: "gray",
};

// 見出しに並べる操作のボタン(表の順)。edit は内容のタブ、verify は検証のタブに置き、apply は
// ボタンにしない(文書の再生成で起きる)
export const HEADER_ACTIONS: ChangeRequestAction[] = ["explain", "agree", "reject", "withdraw", "copy"];

export const ACTION_BUTTON_LABEL: Partial<Record<ChangeRequestAction, string>> = {
  explain: "説明済みにする",
  agree: "合意を記録する",
  reject: "却下を記録する",
  withdraw: "取り下げる",
  copy: "写して出し直す",
};

export function headerActions(allowed: ChangeRequestAction[]): ChangeRequestAction[] {
  return HEADER_ACTIONS.filter((action) => allowed.includes(action));
}

// 文書の再生成に渡せる(合意・反映済み)/段階の生成に渡せる(文書へ反映した後の反映済み)
export function canReflectDocuments(status: ChangeRequestStatus): boolean {
  return status === "agreed" || status === "applied";
}

export function canReflectStages(status: ChangeRequestStatus): boolean {
  return status === "applied";
}

// 反映の後の比較・検証を出せる状態
export function isApplied(status: ChangeRequestStatus): boolean {
  return status === "applied" || status === "verified";
}

// ---- 作成・編集のフォーム ----

export type ChangeRequestForm = {
  title: string;
  content: string;
  background_source: BackgroundSource;
  // <input type="date"> の値(YYYY-MM-DD)。空は日付なし
  background_date: string;
  background_memo: string;
  targets: ChangeRequestTargetIn[];
  adds_requirement: boolean;
  // 基準の束(作成のときだけ。null は最新の束)
  baseline_number: number | null;
};

export function emptyForm(baselineNumber: number | null = null): ChangeRequestForm {
  return {
    title: "",
    content: "",
    background_source: "meeting",
    background_date: "",
    background_memo: "",
    targets: [],
    adds_requirement: false,
    baseline_number: baselineNumber,
  };
}

export function formFromChangeRequest(cr: ChangeRequestRead): ChangeRequestForm {
  return {
    title: cr.title,
    content: cr.content,
    background_source: cr.background_source,
    background_date: cr.background_date ?? "",
    background_memo: cr.background_memo,
    targets: cr.targets.map((t) => ({
      requirement_id: t.requirement_id,
      kind: t.kind,
      proposed_text: t.proposed_text,
    })),
    adds_requirement: cr.adds_requirement,
    baseline_number: cr.baseline_number,
  };
}

// 対象を足す(同じ要件は2回入れない。種類の既定は内容の変更)
export function addTarget(targets: ChangeRequestTargetIn[], requirementId: string): ChangeRequestTargetIn[] {
  if (!requirementId || targets.some((t) => t.requirement_id === requirementId)) return targets;
  return [...targets, { requirement_id: requirementId, kind: "content", proposed_text: "" }];
}

export function removeTarget(targets: ChangeRequestTargetIn[], requirementId: string): ChangeRequestTargetIn[] {
  return targets.filter((t) => t.requirement_id !== requirementId);
}

// 種類を変える。削除には案を書けないので、削除にしたら案を消す
export function setTargetKind(
  targets: ChangeRequestTargetIn[],
  requirementId: string,
  kind: TargetKind,
): ChangeRequestTargetIn[] {
  return targets.map((t) =>
    t.requirement_id === requirementId
      ? { ...t, kind, proposed_text: kind === "delete" ? "" : t.proposed_text }
      : t,
  );
}

export function setTargetProposal(
  targets: ChangeRequestTargetIn[],
  requirementId: string,
  proposedText: string,
): ChangeRequestTargetIn[] {
  return targets.map((t) => (t.requirement_id === requirementId ? { ...t, proposed_text: proposedText } : t));
}

// 送る前に確かめること(サーバーも同じ条件で 422 を返す)。空なら送れる
export function formProblems(form: ChangeRequestForm): string[] {
  const problems: string[] = [];
  if (!form.title.trim()) problems.push("タイトルを入れてください");
  if (!form.content.trim()) problems.push("内容を入れてください");
  if (form.targets.length === 0 && !form.adds_requirement) {
    problems.push("対象の要件を選ぶか、「新しい要件を足す」にしてください");
  }
  return problems;
}

export function toUpdateBody(form: ChangeRequestForm): ChangeRequestUpdate {
  return {
    title: form.title.trim(),
    content: form.content.trim(),
    background_source: form.background_source,
    background_date: form.background_date || null,
    background_memo: form.background_memo,
    targets: form.targets.map((t) => ({
      requirement_id: t.requirement_id,
      kind: t.kind,
      proposed_text: t.kind === "delete" ? "" : t.proposed_text.trim(),
    })),
    adds_requirement: form.adds_requirement,
  };
}

export function toCreateBody(form: ChangeRequestForm): ChangeRequestCreate {
  return {
    ...toUpdateBody(form),
    ...(form.baseline_number !== null ? { baseline_number: form.baseline_number } : {}),
  };
}

// ---- 合意・却下の日時 ----

// <input type="datetime-local"> の今の値(秒なし・手元の時刻)
export function nowLocalInput(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

// datetime-local の値(手元の時刻)を、サーバーが求めるタイムゾーン付きの ISO 文字列にする。
// 読めなければ null
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---- 影響・比較 ----

// 段階の名前(0 は文書の側 = 画面・API)
export function stageLabel(stage: number): string {
  if (stage === 0) return "文書の側(画面・API)";
  return `段階${stage} ${STAGE_TITLES[stage] ?? ""}`.trim();
}

// 段階の順にまとめる(段階の中は渡した順)
export function groupByStage<T extends { stage: number }>(items: T[]): { stage: number; items: T[] }[] {
  const groups = new Map<number, T[]>();
  for (const item of items) {
    groups.set(item.stage, [...(groups.get(item.stage) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([stage, grouped]) => ({ stage, items: grouped }));
}

export const COMPARISON_ORDER: ComparisonStatus[] = ["actual_only", "predicted_only", "matched"];

// 比較の3分類ごとの要素(予測の外 → 予測だけ → 一致の順。見落としを先に見せる)
export function comparisonGroups(
  items: ComparedItemRead[],
): { status: ComparisonStatus; items: ComparedItemRead[] }[] {
  return COMPARISON_ORDER.map((status) => ({ status, items: items.filter((i) => i.status === status) }));
}

// ---- 段階への行き来 ----

// 詳細設計画面のその段階を開くリンク
export function designStageHref(projectId: string, stage: number): string {
  return `/projects/${projectId}/detailed-design?stage=${stage}`;
}

export function changeRequestHref(projectId: string, number: number): string {
  return `/projects/${projectId}/change-requests/${number}`;
}

// 印の出どころ(`cr:<番号>`)から CR の番号を読む
export function crNumberOfSource(source: string): number | null {
  const match = /^cr:(\d+)$/.exec(source);
  return match ? Number(match[1]) : null;
}

// 変更の影響の未確認の印に出どころとして付いている CR の番号(小さい順)。SCR-008 で段階の生成に
// 渡す CR の初期値に使う
export function crNumbersInImpact(impact: DesignImpactRead | null): number[] {
  if (!impact) return [];
  const numbers = new Set<number>();
  for (const stage of impact.stages) {
    for (const mark of stage.marks) {
      if (mark.reviewed) continue;
      for (const source of mark.sources) {
        const number = crNumberOfSource(source);
        if (number !== null) numbers.add(number);
      }
    }
  }
  return [...numbers].sort((a, b) => a - b);
}

// 印のある段階のうち、CR の出どころの印がある段階(段階の作り直しの候補)
export function stagesMarkedBy(impact: DesignImpactRead | null, crNumber: number): number[] {
  if (!impact) return [];
  return impact.stages
    .filter((s) => s.marks.some((m) => !m.reviewed && m.sources.includes(`cr:${crNumber}`)))
    .map((s) => s.stage);
}

// Phase-87-4:追記
// SCR-008 で段階の生成に渡す CR の初期値。反映済みの CR のうち、未確認の印の出どころにある最初の CR
// (無ければ渡さない)
export function defaultReflectionCr(appliedNumbers: number[], impact: DesignImpactRead | null): number | null {
  return crNumbersInImpact(impact).find((n) => appliedNumbers.includes(n)) ?? null;
}

// 部分再生成(段階5・6・8)は再生成の候補から作り直すので、段階の作り直しのボタンは出さない
export const PARTIAL_STAGES = [5, 6, 8];

// Phase-88-2:追記
// ---- 説明書と要約 ----

export const SUMMARY_TONE: Record<SummaryState, string> = {
  unconfirmed: "yellow",
  confirmed: "green",
  stale: "red",
};

// 要約が出力(ダウンロードする md)に載るかの説明。載るのは確認済みで古くないときだけ
export function summaryOutputNote(summary: ExplanationSummaryRead | null): string {
  if (summary === null) return "要約はありません(任意)。出力は5節だけです。";
  if (summary.state === "confirmed") return "確認済みなので、出力の先頭に要約が載ります。";
  if (summary.state === "stale") {
    return "要約を作った・確かめた後に、CR の内容か影響が変わりました。確かめ直すまで、出力に要約は載りません。";
  }
  return "未確認の間は、出力に要約は載りません(このプレビューだけ)。";
}

// 照合で合わない所の印。文を、要件 ID・数字の区切りに分け、5節に無いものに印を付ける。
// 区切り方は devex-api の照合(app/change_requests/explanation.py)と同じ規則(要件 ID の中の数字は
// 数字として数えない。英字に続く・英字が続く数字は名前の一部とみなす)
export type MarkedSegment = { text: string; mark: "id" | "number" | null };

const TOKEN = /\b(?:FR|NFR|CON)-\d+\b|(?<![A-Za-z\d.])\d+(?:\.\d+)?(?![A-Za-z\d])/g;
const REQUIREMENT_ID = /^(?:FR|NFR|CON)-\d+$/;

export function markSegments(text: string, unknownIds: string[], unknownNumbers: string[]): MarkedSegment[] {
  const ids = new Set(unknownIds);
  const numbers = new Set(unknownNumbers);
  const segments: MarkedSegment[] = [];
  let last = 0;
  const push = (part: string, mark: MarkedSegment["mark"]) => {
    if (part === "") return;
    const prev = segments[segments.length - 1];
    if (prev && prev.mark === null && mark === null) prev.text += part;
    else segments.push({ text: part, mark });
  };
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    const isId = REQUIREMENT_ID.test(token);
    const unknown = isId ? ids.has(token) : numbers.has(token);
    push(text.slice(last, match.index), null);
    push(token, unknown ? (isId ? "id" : "number") : null);
    last = match.index + token.length;
  }
  push(text.slice(last), null);
  return segments;
}

// Phase-88(完了後の調整):追記
// ---- モード ----

// 簡易ドキュメントモードのプロジェクトで、CR・合意済みの版の API が断った(409
// DESIGN_STAGES_NOT_AVAILABLE)か。画面は本体の代わりに「詳細設計モードだけ」と知らせる
export function isDetailedModeOnly(err: unknown): boolean {
  return err instanceof ApiError && err.code === "DESIGN_STAGES_NOT_AVAILABLE";
}
