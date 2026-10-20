// 作成：Phase-88-2｜更新：Phase-88(完了後の調整)
import { STAGE_TITLES, STATE_LABELS } from "@/features/detailed-design/labels";
import type { DesignStageRead, StageState } from "@/features/detailed-design/api/types";
import type { ChangeRequestSummaryRead } from "@/features/change-requests/api/types";
import { localInputToIso } from "@/features/change-requests/changeRequestOps";
import type {
  BaselineCreate,
  BaselineItemSummaryRead,
} from "@/features/baselines/api/types";

// 合意済みの版(束)の画面だけが持つ変換(純粋関数)。

const DOCUMENT_LABELS: Record<string, string> = {
  requirements: "要件定義書",
  external_design: "外部設計書",
  test_spec: "テスト仕様書",
};

const STAGE_PREFIX = "stage:";

export function stageOfKey(key: string): number | null {
  if (!key.startsWith(STAGE_PREFIX)) return null;
  const stage = Number(key.slice(STAGE_PREFIX.length));
  return Number.isInteger(stage) ? stage : null;
}

// 写し1件の表示名(文書の名前、または「段階N 名前」)
export function itemLabel(key: string): string {
  const stage = stageOfKey(key);
  if (stage === null) return DOCUMENT_LABELS[key] ?? key;
  return `段階${stage} ${STAGE_TITLES[stage] ?? ""}`.trim();
}

// 写し1件の状態の表示。文書は「写した / 無い」、段階は作った時点の段階の状態
export function itemStateLabel(item: BaselineItemSummaryRead): string {
  if (stageOfKey(item.key) === null) return item.included ? "写した" : "無い";
  return STATE_LABELS[item.state as StageState] ?? item.state;
}

export const baselineHref = (projectId: string, number: number) => `/projects/${projectId}/baselines/${number}`;
export const baselinesHref = (projectId: string) => `/projects/${projectId}/baselines`;
// Phase-88(完了後の調整):追記
// この束を基準に変更要求を作るページ(基準の束は URL の番号に固定)
export const newChangeRequestHref = (projectId: string, number: number) =>
  `${baselineHref(projectId, number)}/change-requests/new`;

// 束に入れられる CR(検証済みで、まだどの束にも入れていない。番号の順)
export function includableChangeRequests(list: ChangeRequestSummaryRead[]): ChangeRequestSummaryRead[] {
  return list
    .filter((cr) => cr.status === "verified" && cr.included_baseline_number === null)
    .sort((a, b) => a.number - b.number);
}

// この束に入れた CR(番号の順)
export function includedChangeRequests(
  list: ChangeRequestSummaryRead[],
  baselineNumber: number,
): ChangeRequestSummaryRead[] {
  return list
    .filter((cr) => cr.included_baseline_number === baselineNumber)
    .sort((a, b) => a.number - b.number);
}

// 作成のフォームの入力(日時は datetime-local の値)
export type BaselineForm = {
  agreedAt: string;
  counterpart: string;
  memo: string;
  reason: string;
  changeRequestNumbers: number[];
};

// 選んだ CR の合意の記録からの初期値。相手は最初の CR の相手、理由・メモは CR ごとの行を並べる
export function prefillAgreement(
  selected: ChangeRequestSummaryRead[],
): Pick<BaselineForm, "counterpart" | "memo" | "reason"> {
  const decided = selected.filter((cr) => cr.decision !== null);
  const lines = (pick: (d: NonNullable<ChangeRequestSummaryRead["decision"]>) => string) =>
    decided
      .map((cr) => ({ label: cr.label, text: pick(cr.decision!).trim() }))
      .filter((line) => line.text !== "")
      .map((line) => `${line.label}: ${line.text}`)
      .join("\n");
  return {
    counterpart: decided.find((cr) => cr.decision!.counterpart)?.decision!.counterpart ?? "",
    memo: lines((d) => d.memo),
    reason: lines((d) => d.reason),
  };
}

// CR の選択を変えたときの入力。利用者が手で直した欄(touched)は残し、ほかは初期値で埋め直す
export function applySelection(
  form: BaselineForm,
  numbers: number[],
  list: ChangeRequestSummaryRead[],
  touched: ReadonlySet<"counterpart" | "memo" | "reason">,
): BaselineForm {
  const selected = list.filter((cr) => numbers.includes(cr.number)).sort((a, b) => a.number - b.number);
  const prefill = prefillAgreement(selected);
  return {
    ...form,
    changeRequestNumbers: selected.map((cr) => cr.number),
    counterpart: touched.has("counterpart") ? form.counterpart : prefill.counterpart,
    memo: touched.has("memo") ? form.memo : prefill.memo,
    reason: touched.has("reason") ? form.reason : prefill.reason,
  };
}

// 作成の本文(相手が空なら null、日時はタイムゾーン付きにする)。日時が読めなければ null
export function toCreateBody(form: BaselineForm): BaselineCreate | null {
  const agreedAt = localInputToIso(form.agreedAt);
  if (agreedAt === null) return null;
  const counterpart = form.counterpart.trim();
  return {
    agreed_at: agreedAt,
    counterpart: counterpart === "" ? null : counterpart,
    memo: form.memo,
    reason: form.reason.trim(),
    change_request_numbers: form.changeRequestNumbers,
  };
}

// 束を作れない理由(作れるなら null)。段階の生成中は作れない(devex-api も409)
export function createBlocker(stages: DesignStageRead[] | null, form: BaselineForm): string | null {
  if (stages?.some((s) => s.generation_status === "generating")) {
    return "段階を生成している間は、合意済みの版を作れません。生成が終わってから作ってください。";
  }
  if (form.reason.trim() === "") return "理由を入れてください。";
  if (localInputToIso(form.agreedAt) === null) return "合意の日時を入れてください。";
  return null;
}

// 作った時点で束に入る段階・入らない段階(今の段階の一覧から。承認の写しがあれば入る)
export function stagePreview(stages: DesignStageRead[]): { stage: number; title: string; included: boolean; state: string }[] {
  return [...stages]
    .sort((a, b) => a.stage - b.stage)
    .map((s) => ({
      stage: s.stage,
      title: STAGE_TITLES[s.stage] ?? "",
      included: s.approved_version !== null,
      state: STATE_LABELS[s.state],
    }));
}
