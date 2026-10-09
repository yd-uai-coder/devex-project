// 作成：Phase-33-3
// 構造化した要件定義の見本(appendix/structured-requirements-sample/)を画面で確かめるデモの意味モデルと純粋関数。
// ヒアリングの完了は、観点ごとの状態から決定的に判定する(LLM には判定させない)。

export type Scale = "personal" | "internal" | "public";
export type PointKind = "function" | "nonfunctional";
export type PointKey =
  | "scale"
  | "purpose"
  | "users"
  | "daily_flow"
  | "core"
  | "scope"
  | "exceptions"
  | "future"
  | "tech"
  | "schedule"
  | "availability"
  | "performance"
  | "operability"
  | "migration"
  | "security"
  | "environment";
export type PointStatus = "decided" | "adopted" | "open" | "not_applicable";

export type PointDef = {
  key: PointKey;
  kind: PointKind;
  label: string;
  question: string; // 場面で聞く問いの例
  required: Record<Scale, boolean>;
};

export type PointState = {
  key: PointKey;
  status: PointStatus;
  summary: string; // 決めたこと
  evidence: string; // 根拠(どの発言か)
};

export const SCALES: Scale[] = ["personal", "internal", "public"];
export const SCALE_LABEL: Record<Scale, string> = {
  personal: "個人・小規模",
  internal: "社内",
  public: "公開サービス",
};
export const KIND_LABEL: Record<PointKind, string> = { function: "機能面", nonfunctional: "非機能" };
export const STATUS_LABEL: Record<PointStatus, string> = {
  decided: "ユーザーが決定",
  adopted: "AI の提案を採用",
  open: "未決",
  not_applicable: "対象外",
};

// 規模ごとの必須(個人・小規模 / 社内 / 公開サービス)
const ALL = { personal: true, internal: true, public: true };
const req = (personal: boolean, internal: boolean, pub: boolean) => ({ personal, internal, public: pub });

// 機能面の観点 + IPA の非機能要求グレードの6大項目。技術スタックは規模によらず必須
export const POINT_DEFS: PointDef[] = [
  { key: "scale", kind: "function", label: "規模", question: "使うのは自分(と数人)だけですか。社内の人ですか。誰でも登録できるサービスですか", required: ALL },
  { key: "purpose", kind: "function", label: "目的・課題", question: "これが無いと、今は何に困っていますか", required: ALL },
  { key: "users", kind: "function", label: "利用者と使う場面", question: "誰が、どんなときに開きますか", required: ALL },
  { key: "daily_flow", kind: "function", label: "利用者の1日の流れ", question: "使う人の1日のどこで、どのくらいの時間使いますか", required: req(false, true, true) },
  { key: "core", kind: "function", label: "コア機能", question: "最初の版で、これだけはできてほしいことは何ですか", required: ALL },
  { key: "scope", kind: "function", label: "MVP の範囲", question: "最初の版で作らないと決めているものはありますか", required: ALL },
  { key: "exceptions", kind: "function", label: "例外の場面", question: "入力を間違えた・取り消したい・途中で失敗した・権限が無い、のときにどうなってほしいですか", required: ALL },
  { key: "future", kind: "function", label: "将来の拡張", question: "後で足したいと思っているものはありますか", required: req(false, false, true) },
  { key: "tech", kind: "function", label: "技術スタック・環境の制約", question: "使いたい(使わなければならない)言語・フレームワーク・置き場所はありますか", required: ALL },
  { key: "schedule", kind: "function", label: "体制・期間", question: "何人で、いつまでに作りますか", required: req(false, false, false) },
  { key: "availability", kind: "nonfunctional", label: "可用性", question: "夜中や休日に止まっていたら、どのくらいで困りますか", required: ALL },
  { key: "performance", kind: "nonfunctional", label: "性能・拡張性", question: "同時に何人くらいが使いますか。待てるのは何秒までですか", required: ALL },
  { key: "operability", kind: "nonfunctional", label: "運用・保守性", question: "止まったことに、誰がどうやって気づけばよいですか", required: req(false, true, true) },
  { key: "migration", kind: "nonfunctional", label: "移行性", question: "今使っている仕組みやデータから、移すものはありますか", required: req(false, true, true) },
  { key: "security", kind: "nonfunctional", label: "セキュリティ", question: "入れたデータを、誰に見られたら困りますか", required: ALL },
  { key: "environment", kind: "nonfunctional", label: "システム環境・エコロジー", question: "どの端末・ブラウザで使いますか", required: req(false, true, true) },
];

export function pointDef(key: PointKey): PointDef {
  const def = POINT_DEFS.find((d) => d.key === key);
  if (!def) throw new Error(`unknown point: ${key}`);
  return def;
}

export function isRequired(key: PointKey, scale: Scale): boolean {
  return pointDef(key).required[scale];
}

// 必須なのに未決の観点(定義の順)
export function openRequired(states: PointState[], scale: Scale): PointDef[] {
  const status = new Map(states.map((s) => [s.key, s.status]));
  return POINT_DEFS.filter((d) => d.required[scale] && (status.get(d.key) ?? "open") === "open");
}

// ヒアリングの完了: 必須の観点がすべて未決以外(対象外でもよい)
export function isSufficient(states: PointState[], scale: Scale): boolean {
  return openRequired(states, scale).length === 0;
}

export function countByStatus(states: PointState[]): Record<PointStatus, number> {
  const counts: Record<PointStatus, number> = { decided: 0, adopted: 0, open: 0, not_applicable: 0 };
  for (const s of states) counts[s.status] += 1;
  return counts;
}

// ---- 選択肢カード ----

export type CardOption = { label: string; consequence: string; recommended?: boolean };
export type QuestionCard = { point: PointKey; question: string; options: CardOption[] };

function updatePoint(states: PointState[], next: PointState): PointState[] {
  return states.map((s) => (s.key === next.key ? next : s));
}

// カードの選択肢を選ぶと「AI の提案を採用」
export function answerByCard(states: PointState[], card: QuestionCard, option: CardOption, evidence: string): PointState[] {
  return updatePoint(states, { key: card.point, status: "adopted", summary: option.label, evidence });
}

// 自分の言葉で答えると「ユーザーが決定」。空なら何も変えない
export function answerByText(states: PointState[], key: PointKey, text: string, evidence: string): PointState[] {
  const summary = text.trim();
  if (summary === "") return states;
  return updatePoint(states, { key, status: "decided", summary, evidence });
}

// 次に出すカード: 観点が未決のもののうち、必須を先に(同じならカードの順)
export function nextCard(cards: QuestionCard[], states: PointState[], scale: Scale): QuestionCard | undefined {
  const open = new Set(states.filter((s) => s.status === "open").map((s) => s.key));
  const pending = cards.filter((c) => open.has(c.point));
  return pending.find((c) => isRequired(c.point, scale)) ?? pending[0];
}

// ---- 要件と追跡 ----

export type ReqKind = "FR" | "NFR" | "CON";
export type ReqSource = "user" | "adopted" | "assumed";
export type Priority = "Must" | "Should" | "Could";

export type Requirement = {
  id: string; // FR-001 / NFR-001 / CON-001
  kind: ReqKind;
  priority?: Priority; // 機能要件だけ
  text: string;
  source: ReqSource;
  point: PointKey;
};

export const REQ_SOURCES: ReqSource[] = ["user", "adopted", "assumed"];
export const SOURCE_LABEL: Record<ReqSource, string> = { user: "ユーザー", adopted: "採用", assumed: "推測" };

export function countBySource(reqs: Requirement[]): Record<ReqSource, number> {
  const counts: Record<ReqSource, number> = { user: 0, adopted: 0, assumed: 0 };
  for (const r of reqs) counts[r.source] += 1;
  return counts;
}

export type FunctionRow = { id: string; name: string; reqIds: string[] }; // 段階1の機能
export type UnitRow = { id: string; functionIds: string[] }; // 段階7の作業単位

export type TraceRow = { req: Requirement; functions: FunctionRow[]; units: UnitRow[] };

// 機能要件 → 処理(段階1の req_ids)→ 作業単位(段階7の function_ids から導く)
export function trace(reqs: Requirement[], functions: FunctionRow[], units: UnitRow[]): TraceRow[] {
  return reqs
    .filter((r) => r.kind === "FR")
    .map((r) => {
      const fns = functions.filter((f) => f.reqIds.includes(r.id));
      const ids = new Set(fns.map((f) => f.id));
      return { req: r, functions: fns, units: units.filter((u) => u.functionIds.some((id) => ids.has(id))) };
    });
}

export type TraceIssue = { severity: "major" | "minor"; message: string };

// 段階1の検証: 処理の無い Must の機能要件(中程度)、要件の無い処理・要件定義書に無い要件ID(軽微)
export function traceIssues(reqs: Requirement[], functions: FunctionRow[]): TraceIssue[] {
  const known = new Set(reqs.map((r) => r.id));
  const linked = new Set(functions.flatMap((f) => f.reqIds));
  const issues: TraceIssue[] = [];
  for (const r of reqs) {
    if (r.kind === "FR" && r.priority === "Must" && !linked.has(r.id)) {
      issues.push({ severity: "major", message: `${r.id} は Must の機能要件ですが、担う処理がありません。` });
    }
  }
  for (const f of functions) {
    if (f.reqIds.length === 0) {
      issues.push({ severity: "minor", message: `${f.id} ${f.name} に要件がありません。` });
    }
    for (const id of f.reqIds.filter((id) => !known.has(id))) {
      issues.push({ severity: "minor", message: `${f.id} の要件 ${id} が要件定義書にありません。` });
    }
  }
  return issues;
}
