// 作成：Phase-87-1｜更新：Phase-87-3,87-4,88-2,88(完了後の調整),98-2,99(完了後の調整),107-1,107-2,107-4,107-5,109-2,110(完了後の調整),112-2,112-4
  // Phase-88-2:追記
// Phase-88(完了後の調整):追記
// Phase-98-2:追記 ── @/features/change-requests/api/types.ChangeRequestOriginRead, @/features/baselines/api/types.OriginKind
// Phase-99(完了後の調整):追記 ── @/features/change-requests/api/types.ChangeRequestVerificationRead
// Phase-107-1:追記 ── @/features/change-requests/api/types.ChangeRequestExplanationRead, @/features/change-requests/api/types.ScaleComparisonRead, @/features/change-requests/api/types.ScaleCountRead
// Phase-107-2:追記 ── @/features/change-requests/api/types.ChangeRequestOptionsIn, @/features/change-requests/api/types.ChangeRequestOptionsRead, @/features/change-requests/api/types.ChangeRequestTargetRead
// Phase-107-4:追記 ── @/features/change-requests/api/types.ShareLinkRead, @/features/change-requests/api/types.ShareState
// Phase-107-5:追記 ── @/features/change-requests/api/types.ChangeRequestCommentRead
// Phase-110(完了後の調整):追記 ── @/features/change-requests/api/types.OptionDraftRead
// Phase-112-2:追記 ── @/features/change-requests/api/types.ReflectionChangeRead, @/features/change-requests/api/types.ReflectionScope
// Phase-112-4:追記 ── @/features/change-requests/api/types.ChangeRequestConflictRead
import type {
  BackgroundSource,
  ChangeRequestAction,
  ChangeRequestCommentRead,
  ChangeRequestConflictRead,
  ChangeRequestCreate,
  ChangeRequestExplanationRead,
  ChangeRequestOptionsIn,
  ChangeRequestOptionsRead,
  ChangeRequestOriginRead,
  ChangeRequestRead,
  ChangeRequestStatus,
  ChangeRequestTargetIn,
  ChangeRequestTargetRead,
  ChangeRequestUpdate,
  ChangeRequestVerificationRead,
  ComparedItemRead,
  ComparisonStatus,
  ExplanationSummaryRead,
  OptionDraftRead,
  ReflectionChangeRead,
  ReflectionScope,
  ScaleComparisonRead,
  ScaleCountRead,
  ShareLinkRead,
  ShareState,
  SummaryState,
  TargetKind,
} from "@/features/change-requests/api/types";
import { ApiError } from "@/lib/api/client";
import type { OriginKind } from "@/features/baselines/api/types";
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
  // Phase-98-2:追記
  // 新しい要件の予測の起点の要素のキー(選んだ順。新しい要件を足すときだけ送る)
  origins: string[];
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
    // Phase-98-2:追記
    origins: [],
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
    // Phase-98-2:追記
    origins: cr.origins.map((o) => o.key),
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
// Phase-98-2:追記
}

// ---- 新しい要件の予測の起点 ----

export const ORIGIN_KIND_LABEL: Record<OriginKind, string> = {
  requirement: "要件",
  screen: "画面",
  api: "API",
  // Phase-109-2:追記
  function: "処理",
};

// 起点を足す(同じ要素は2回入れない)
export function addOrigin(origins: string[], key: string): string[] {
  if (!key || origins.includes(key)) return origins;
  return [...origins, key];
}

export function removeOrigin(origins: string[], key: string): string[] {
  return origins.filter((o) => o !== key);
}

// 起点のキーの表示名(知らないキーはキーのまま)
export function originLabel(origins: ChangeRequestOriginRead[], key: string): string {
  return origins.find((o) => o.key === key)?.label ?? key;
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
    // Phase-98-2:追記
    // 起点は新しい要件を足す CR だけが持てる(外したら空にして送る。サーバーは起点だけ残ると断る)
    origins: form.adds_requirement ? form.origins : [],
  };
}

export function toCreateBody(form: ChangeRequestForm): ChangeRequestCreate {
  return {
    ...toUpdateBody(form),
    ...(form.baseline_number !== null ? { baseline_number: form.baseline_number } : {}),
  };
}

// Phase-107-2:追記
// ---- 選択肢(案) ----

// 案は0件か2〜3件(devex-api app/change_requests/options.py の OPTIONS_MIN・OPTIONS_MAX)
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 3;

export type OptionForm = { name: string; targets: ChangeRequestTargetIn[]; outcome: string };
export type OptionsForm = { items: OptionForm[]; recommended: number | null; reason: string };

export function optionLabel(number: number): string {
  return `案${number}`;
}

export function optionsFormFromCr(options: ChangeRequestOptionsRead | null): OptionsForm {
  if (options === null) return { items: [], recommended: null, reason: "" };
  return {
    items: options.items.map((o) => ({
      name: o.name,
      targets: o.targets.map((t) => ({ requirement_id: t.requirement_id, kind: t.kind, proposed_text: t.proposed_text })),
      outcome: o.outcome,
    })),
    recommended: options.recommended,
    reason: options.reason,
  };
}

// 案を足す。2件に満たないと保存できないので、初めて足すときは2つ並べる
export function addOption(form: OptionsForm): OptionsForm {
  if (form.items.length >= OPTIONS_MAX) return form;
  const blank = (): OptionForm => ({ name: "", targets: [], outcome: "" });
  return { ...form, items: form.items.length === 0 ? [blank(), blank()] : [...form.items, blank()] };
}

// 案を消す。おすすめの番号は消した案の後ろを1つ詰め、消した案がおすすめなら外す(理由は残す)
export function removeOption(form: OptionsForm, index: number): OptionsForm {
  const items = form.items.filter((_, i) => i !== index);
  const removed = index + 1;
  let recommended = form.recommended;
  if (recommended === removed) recommended = null;
  else if (recommended !== null && recommended > removed) recommended -= 1;
  return { ...form, items, recommended };
}

export function updateOption(form: OptionsForm, index: number, patch: Partial<OptionForm>): OptionsForm {
  return { ...form, items: form.items.map((o, i) => (i === index ? { ...o, ...patch } : o)) };
}

// 案で変える対象の入り切り。入れるときは CR の対象の種類と変更後の案を写して始める
export function toggleOptionTarget(option: OptionForm, target: ChangeRequestTargetRead, on: boolean): OptionForm {
  const without = option.targets.filter((t) => t.requirement_id !== target.requirement_id);
  if (!on) return { ...option, targets: without };
  const added = { requirement_id: target.requirement_id, kind: target.kind, proposed_text: target.proposed_text };
  return { ...option, targets: [...without, added] };
}

// 合意で選んだ案の表示(「案1 名前」。案が消えていれば番号だけ)
export function decidedOptionLabel(cr: ChangeRequestRead): string {
  const number = cr.decision?.option ?? null;
  if (number === null) return "";
  const option = cr.options?.items.find((o) => o.number === number);
  return option ? `${option.label} ${option.name}` : optionLabel(number);
}

// 保存の前に確かめること(サーバーも同じ規則で 422 を返す)。空なら保存できる
export function optionsProblems(form: OptionsForm, crTargets: ChangeRequestTargetRead[], addsRequirement: boolean): string[] {
  const problems: string[] = [];
  const count = form.items.length;
  // 案を全部消したら、おすすめも外して送る(toOptionsBody)
  if (count === 0) return problems;
  if (count < OPTIONS_MIN || count > OPTIONS_MAX) problems.push(`案は${OPTIONS_MIN}〜${OPTIONS_MAX}件にしてください`);
  const known = new Set(crTargets.map((t) => t.requirement_id));
  const names = new Set<string>();
  form.items.forEach((option, i) => {
    const label = optionLabel(i + 1);
    const name = option.name.trim().split(/\s+/).join(" ");
    if (!name || !option.outcome.trim()) problems.push(`${label}に名前と結果を書いてください`);
    if (name && names.has(name)) problems.push(`${label}の名前がほかの案と重なっています`);
    names.add(name);
    const unknown = option.targets.filter((t) => !known.has(t.requirement_id)).map((t) => t.requirement_id);
    if (unknown.length > 0) problems.push(`${label}の対象が CR の対象にありません: ${unknown.join(", ")}`);
    if (option.targets.length === 0 && !addsRequirement) problems.push(`${label}で変える要件を選んでください`);
  });
  if (form.recommended !== null) {
    if (form.recommended < 1 || form.recommended > count) problems.push("おすすめの案を選び直してください");
    if (!form.reason.trim()) problems.push("おすすめの理由を書いてください");
  } else if (form.reason.trim()) {
    problems.push("おすすめの案を選ばずに理由は書けません");
  }
  return problems;
}

export function toOptionsBody(form: OptionsForm): ChangeRequestOptionsIn {
  if (form.items.length === 0) return { items: [], recommended: null, reason: "" };
  return {
    items: form.items.map((o) => ({
      name: o.name.trim(),
      targets: o.targets.map((t) => ({
        requirement_id: t.requirement_id,
        kind: t.kind,
        proposed_text: t.kind === "delete" ? "" : t.proposed_text.trim(),
      })),
      outcome: o.outcome.trim(),
    })),
    recommended: form.recommended,
    reason: form.recommended === null ? "" : form.reason.trim(),
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
// Phase-99(完了後の調整):追記
// 詳細設計の画面の CR の帯の文(未確認の印・文書の側・未承認の段階の数)。検証を開く前に、残りを見せる
export function verifyBannerText(
  verification: Pick<ChangeRequestVerificationRead, "open_marks" | "open_documents" | "pending_stages">,
): string {
  return `未確認の印 ${verification.open_marks} / 文書の側 ${verification.open_documents} / 未承認の段階 ${verification.pending_stages.length}`;
}

export function designStageHref(projectId: string, stage: number): string {
  return `/projects/${projectId}/detailed-design?stage=${stage}`;
}

// Phase-112-2：更新
// export function changeRequestHref(projectId: string, number: number): string {
//   return `/projects/${projectId}/change-requests/${number}`;
// ↓↓
export function changeRequestHref(
  projectId: string,
  number: number,
  open: { tab?: DetailTab; focus?: string } = {},
): string {
  const query = new URLSearchParams();
  if (open.tab) query.set("tab", open.tab);
  if (open.focus) query.set("focus", open.focus);
  const search = query.toString();
  return `/projects/${projectId}/change-requests/${number}${search ? `?${search}` : ""}`;
}

// CR の詳細のタブ(URL の ?tab= で開くタブを選べる)
export const DETAIL_TABS = ["content", "impact", "verification", "explanation", "share", "trace"] as const;
export type DetailTab = (typeof DETAIL_TABS)[number];

// URL の値から開くタブ(知らない値・無ければ「内容」)
export function detailTabOf(value: string | undefined): DetailTab {
  return DETAIL_TABS.find((t) => t === value) ?? "content";
}

// Phase-112-4:追記
// 重なる CR の競合のうち、今の文と見比べて確かめていないもの
export function uncheckedConflicts(cr: Pick<ChangeRequestRead, "conflicts">): ChangeRequestConflictRead[] {
  return cr.conflicts.filter((c) => !c.checked);
}

// 説明済み・合意・反映の確かめの画面に出す、競合の知らせの1行(未確認の競合が無ければ null)
export function conflictNoticeLine(cr: Pick<ChangeRequestRead, "conflicts">): string | null {
  const pending = uncheckedConflicts(cr);
  if (pending.length === 0) return null;
  const items = pending.map((c) => `${c.requirement_id}(${c.by.join("・")} が先に変えた)`).join("、");
  return `対象の要件が、基準の束の後にほかの CR の反映で変わっています: ${items}。案が先の変更を消さないか、今の文と見比べてください。`;
}

// 反映の前 → 後の見出しの並び(CR の対象 → 予測した要素 → 範囲の外 → 合意の形に戻した)
export type ReflectionGroupKey = ReflectionScope | "restored";

const REFLECTION_GROUP_ORDER: ReflectionGroupKey[] = ["target", "predicted", "outside", "restored"];
const REFLECTION_GROUP_TITLE: Record<ReflectionGroupKey, string> = {
  target: "CR の対象",
  predicted: "予測した要素(画面・API)",
  outside: "範囲の外(予測に無い所)",
  restored: "合意の形に戻した(範囲の外の書き換えを戻した)",
};

// 反映1回の前 → 後を見出しごとに分ける(空の見出しは出さない。中は応答の順)
export function reflectionGroups(
  changes: ReflectionChangeRead[],
): { key: ReflectionGroupKey; title: string; changes: ReflectionChangeRead[] }[] {
  return REFLECTION_GROUP_ORDER.map((key) => ({
    key,
    title: REFLECTION_GROUP_TITLE[key],
    changes: changes.filter((c) => (c.change === "restored" ? "restored" : c.scope) === key),
  })).filter((group) => group.changes.length > 0);
}

// 戻した理由の表示(changed = LLM が書き換えた、dropped = LLM が落とした)
export function restoreReasonLabel(reason: string | null): string {
  if (reason === "dropped") return "LLM が落としたのを戻した";
  if (reason === "changed") return "LLM が書き換えたのを戻した";
  return "";
}

// Phase-109-2:追記
// CR の表示名(devex-api の label と同じ形。番号だけを持つ応答から名前を出す)
export function changeRequestLabel(number: number): string {
  return `CR-${number}`;
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

// Phase-110(完了後の調整):追記
// 下書きの「作った後に説明書が変わりました」を出すか。取り込んだ下書きは、取り込みで CR の案が
// 変わり説明書も変わるので、古くなっていても知らせない(取り込んだ直後に出ると、取り込みが
// 失敗したように見えるため)
export function draftStaleNotice(draft: Pick<OptionDraftRead, "stale" | "status">): boolean {
  return draft.stale && draft.status !== "adopted";
}

// Phase-107-1:追記
// ---- 変更の規模 ----

// 規模の表の1列(案のある CR の合意の前は案ごと、それ以外は CR の1列)
export type ScaleColumn = { key: string; title: string; recommended: boolean; scale: ScaleCountRead[] };

export function scaleColumns(explanation: ChangeRequestExplanationRead): ScaleColumn[] {
  if (explanation.option_scales.length > 0) {
    return explanation.option_scales.map((o) => ({
      key: o.label,
      title: `${o.label} ${o.name}`,
      recommended: o.recommended,
      scale: o.scale,
    }));
  }
  return [{ key: "cr", title: "この変更", recommended: false, scale: explanation.scale }];
}

// 数は「n件」、数えられなければ「数えられない」(0件と書かない)
export function scaleCell(count: number | null): string {
  return count === null ? "数えられない" : `${count}件`;
}

// 表の下に出す理由・注記の1行。同じ列で同じ理由・注記の種類は1行にまとめる(説明書の3節と同じ)。
// 列が複数なら行の頭に列の名前を付ける
export type ScaleRemarkLine = { text: string; uncountable: boolean };

export function scaleRemarkLines(columns: ScaleColumn[]): ScaleRemarkLine[] {
  const lines: { key: string; prefix: string; kinds: string[]; body: string; uncountable: boolean }[] = [];
  for (const column of columns) {
    const prefix = columns.length > 1 ? `${column.title} ── ` : "";
    for (const count of column.scale) {
      const remarks = [
        ...count.uncountable.map((r) => ({ remark: r, uncountable: true })),
        ...count.notes.map((r) => ({ remark: r, uncountable: false })),
      ];
      for (const { remark, uncountable } of remarks) {
        const body = remark.detail ? `${remark.label}(${remark.detail})` : remark.label;
        const key = `${column.key}|${uncountable}|${remark.code}|${body}`;
        const found = lines.find((line) => line.key === key);
        if (found) {
          if (!found.kinds.includes(count.label)) found.kinds.push(count.label);
        } else {
          lines.push({ key, prefix, kinds: [count.label], body, uncountable });
        }
      }
    }
  }
  return lines.map((line) => ({
    text: `${line.prefix}${line.kinds.join("・")}${line.uncountable ? "は数えられない" : ""}: ${line.body}`,
    uncountable: line.uncountable,
  }));
}

// 反映の後の比較の1行の文(数えられなければ「数えられない」)と、数え方の注記
export function scaleComparisonBasis(row: ScaleComparisonRead): string {
  return row.basis === "document_checks"
    ? "予測のうち、文書の側の確認の一覧で確かめた数"
    : "反映で付いた印から、今の設計で数えた数";
}

// Phase-107-4:追記
// ---- 共有リンク ----

// 期限の日数(devex-api app/change_requests/sharing.py の DEFAULT_EXPIRES_DAYS・MAX_EXPIRES_DAYS)
export const SHARE_DEFAULT_DAYS = 14;
export const SHARE_MAX_DAYS = 90;

export const SHARE_STATE_TONE: Record<ShareState, string> = {
  open: "green",
  paused: "yellow",
  decided: "blue",
  closed: "gray",
  expired: "red",
  revoked: "red",
};

// リンクを作れる CR の状態(作ると下書きは説明済みになる)
export function canShare(status: ChangeRequestStatus): boolean {
  return status === "draft" || status === "explained";
}

// クライアントに送る URL(応答の path に、今開いている Devex の origin を付ける)
export function shareUrl(path: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${path}`;
}

// 期限の日数の入力の問題(null なら送れる)
export function shareDaysProblem(value: string): string | null {
  const days = Number(value);
  if (!value.trim() || !Number.isInteger(days) || days < 1 || days > SHARE_MAX_DAYS) {
    return `期限は1〜${SHARE_MAX_DAYS}日で入れてください`;
  }
  return null;
}

// 今使えるリンク(取り消し・期限切れでないもの)。CR に有効なリンクは1本
export function activeShareLink(links: ShareLinkRead[]): ShareLinkRead | null {
  return links.find((l) => l.state !== "revoked" && l.state !== "expired") ?? null;
}

// Phase-107-5:追記
// ---- コメント ----

// 返信の本文の上限(devex-api app/change_requests/comments.py の COMMENT_BODY_MAX)
export const COMMENT_BODY_MAX = 2000;

// コメントの書き手(クライアントは書いた名前、返信は開発者)
export function commentAuthor(comment: ChangeRequestCommentRead): string {
  return comment.from_developer ? "開発者(返信)" : `${comment.author_name}(クライアント)`;
}

// コメントが、今の説明書より前の版を見て書かれたか(説明書の指紋が違う)
export function commentedOnOlderVersion(comment: ChangeRequestCommentRead, fingerprint: string | null): boolean {
  return fingerprint !== null && comment.fingerprint !== "" && comment.fingerprint !== fingerprint;
}

// Phase-88(完了後の調整):追記
// ---- モード ----

// 簡易ドキュメントモードのプロジェクトで、CR・合意済みの版の API が断った(409
// DESIGN_STAGES_NOT_AVAILABLE)か。画面は本体の代わりに「詳細設計モードだけ」と知らせる
export function isDetailedModeOnly(err: unknown): boolean {
  return err instanceof ApiError && err.code === "DESIGN_STAGES_NOT_AVAILABLE";
}
