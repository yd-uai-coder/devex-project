// 作成：Phase-116-1｜更新：Phase-116-2,116(完了後の調整)
// Phase-116-2:追記 ── @/features/materials/api/types.MaterialInput
import { ApiError } from "@/lib/api/client";
import type {
  DifferenceKind,
  DifferenceStatus,
  MaterialDifferenceRead,
  MaterialDifferencesRead,
  MaterialInput,
  MaterialKind,
  MaterialSource,
} from "@/features/materials/api/types";

// 資料の画面(SCR-013。docs/external_design.md 2.17節)の純粋な変換。

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  minutes: "議事録",
  email: "メール",
  document: "資料",
};

export const MATERIAL_SOURCE_LABEL: Record<MaterialSource, string> = {
  paste: "貼り付け",
  txt: "txt",
  md: "md",
  pdf: "PDF",
};

export const DIFFERENCE_KIND_LABEL: Record<DifferenceKind, string> = {
  add: "追加",
  change: "変更",
  delete: "削除",
  question: "確かめる点",
};

export const DIFFERENCE_STATUS_LABEL: Record<DifferenceStatus, string> = {
  unconfirmed: "未確認",
  rejected: "弾いた",
  converted: "CR にした",
  dismissed: "捨てた",
};

// 資料の本文の上限(devex-api と同じ。超えたら断られるので、送る前に知らせる)
export const MATERIAL_BODY_MAX = 20_000;
// ファイルの大きさの上限と、受け付ける形式
export const MATERIAL_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const MATERIAL_FILE_ACCEPT = ".txt,.md,.pdf";

export function materialsHref(projectId: string): string {
  return `/projects/${projectId}/materials`;
}

export function materialHref(projectId: string, materialId: string): string {
  return `${materialsHref(projectId)}/${materialId}`;
}

// Phase-116-2:追記
// 資料を足すフォーム(本文の貼り付けか、ファイル。日付は YYYY-MM-DD)
export type MaterialForm = {
  kind: MaterialKind;
  title: string;
  materialDate: string;
  source: "paste" | "file";
  body: string;
  file: File | null;
};

// 今日の日付(端末の時刻で YYYY-MM-DD。日付の欄の既定)
export function todayInput(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 足せない理由(無ければ null)。本文の長さ・ファイルの大きさと形式は、送る前にここで止める
export function materialFormBlocker(form: MaterialForm): string | null {
  // Phase-116(完了後の調整)：更新
  // if (!form.title.trim()) return "題を書いてください。";
  // ↓↓
  if (!form.title.trim()) return "タイトルを書いてください。";
  if (!form.materialDate) return "日付を選んでください。";
  if (form.source === "paste") {
    const length = form.body.trim().length;
    if (length === 0) return "本文を貼り付けてください。";
    if (length > MATERIAL_BODY_MAX) {
      return `本文が長すぎます(${length}文字。上限は${MATERIAL_BODY_MAX}文字)。分けて足してください。`;
    }
    return null;
  }
  if (form.file === null) return "ファイルを選んでください。";
  if (!/\.(txt|md|pdf)$/i.test(form.file.name)) return "txt・md・pdf のファイルを選んでください。";
  if (form.file.size > MATERIAL_FILE_MAX_BYTES) return "ファイルが大きすぎます(上限は2MB)。";
  return null;
}

// フォームを API の入力にする(足せないときは null)
export function toMaterialInput(form: MaterialForm): MaterialInput | null {
  if (materialFormBlocker(form) !== null) return null;
  const meta = { kind: form.kind, title: form.title.trim(), material_date: form.materialDate };
  return form.source === "file" && form.file !== null ? { meta, file: form.file } : { meta, body: form.body.trim() };
}

// 合意の要素のキーの見せ方("req:FR-001" → "FR-001"。利用者と使う場面はキーが "users")
export function elementLabel(key: string): string {
  if (key === "users") return "利用者と使う場面";
  const i = key.indexOf(":");
  return i < 0 ? key : key.slice(i + 1);
}

// 違いの一覧の群。未確認(判断する違い)を上に、判断した・弾いた違いを下に。群の中は API の順(取り出しの順)
export type DifferenceGroup = { status: DifferenceStatus; label: string; items: MaterialDifferenceRead[] };

const GROUP_ORDER: DifferenceStatus[] = ["unconfirmed", "converted", "dismissed", "rejected"];

export function groupDifferences(differences: MaterialDifferenceRead[]): DifferenceGroup[] {
  return GROUP_ORDER.map((status) => ({
    status,
    label: DIFFERENCE_STATUS_LABEL[status],
    items: differences.filter((d) => d.status === status),
  })).filter((group) => group.items.length > 0);
}

// CR の下書きに選べる違い(未確認の追加・変更・削除。確かめる点は理由をつけて閉じる)
export function isDraftable(difference: MaterialDifferenceRead): boolean {
  return difference.status === "unconfirmed" && difference.kind !== "question";
}

// 対象の要件を開発者が選ぶ違い(画面・API・外部連携の変更・削除で、つながる要件があるもの)
export function choosesRequirements(difference: MaterialDifferenceRead): boolean {
  return isDraftable(difference) && !difference.target_key.startsWith("req:") && difference.requirement_candidates.length > 0;
}

// 選んだ違いで外した候補の要件(違いの id → 外した要件 ID)。既定は候補すべてを選んだ形(空)
export type UncheckedRequirements = Record<string, string[]>;

// CR の下書きの requirement_ids。選んだ違いで1つも外していなければ省く(サーバーが候補すべてを対象にする)。
// 外していれば、選んだ違いの残った候補を合わせて送る
export function requirementIdsFor(
  selected: MaterialDifferenceRead[],
  unchecked: UncheckedRequirements,
): string[] | undefined {
  const choosing = selected.filter(choosesRequirements);
  if (choosing.every((d) => (unchecked[d.id] ?? []).length === 0)) return undefined;
  const ids = choosing.flatMap((d) => d.requirement_candidates.filter((id) => !(unchecked[d.id] ?? []).includes(id)));
  return [...new Set(ids)];
}

// 候補の要件を全部外した違い(対象が無くなるので、作る前に止める)
export function withoutRequirement(
  selected: MaterialDifferenceRead[],
  unchecked: UncheckedRequirements,
): MaterialDifferenceRead[] {
  return selected
    .filter(choosesRequirements)
    .filter((d) => d.requirement_candidates.every((id) => (unchecked[d.id] ?? []).includes(id)));
}

// 違いを取り出した後に束を作り直したか(そのままでは CR にできない。取り出し直す)
export function isExtractionOutdated(view: MaterialDifferencesRead): boolean {
  return view.extraction !== null && view.latest_baseline_number !== view.extraction.baseline_number;
}

// 資料の画面の失敗の文。サーバーの文に、次にすることの案内を足すもの
export function materialErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.code === "MATERIAL_DIFFERENCE_OUTDATED") {
      return "違いを取り出した後に、合意済みの版が作り直されました。最新の版と比べて取り出し直してから、CR にしてください。";
    }
    if (err.code === "MATERIAL_BASELINE_MISSING") {
      return "合意済みの版がまだありません。比べる相手が無いので、先に合意済みの版を作ってください。";
    }
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}
