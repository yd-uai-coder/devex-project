// 作成：Phase-97-2
import type {
  AgreementStatusRead,
  ElementState,
  ElementStatusRead,
  HistoryEntryRead,
  RelatedChangeRequestRead,
} from "@/features/agreements/api/types";

// 行の合意の画面の、表示の文を決める純粋関数(devex-api の状態・履歴の応答から)。

const STATE_ORDER: ElementState[] = ["agreed", "differs", "unagreed", "missing"];
const STATE_LABEL: Record<ElementState, string> = {
  agreed: "合意済み",
  differs: "合意と違う",
  unagreed: "未合意",
  missing: "今の版に無い",
};

// 状態ごとの件数(合意済み 12 / 合意と違う 1 / 未合意 2)。「今の版に無い」は1件以上のときだけ
export function stateCountsText(elements: ElementStatusRead[]): string {
  return STATE_ORDER.map((state) => ({ state, count: elements.filter((e) => e.state === state).length }))
    .filter(({ state, count }) => state !== "missing" || count > 0)
    .map(({ state, count }) => `${STATE_LABEL[state]} ${count}`)
    .join(" / ");
}

// 要素の印(合意 B-2 / 合意と違う(合意 CR-3)/ 未合意 / 今の版に無い(合意 B-2))
export function elementBadge(element: ElementStatusRead): string {
  const origin = element.origin_label ? `合意 ${element.origin_label}` : "合意";
  if (element.state === "agreed") return origin;
  if (element.state === "unagreed") return STATE_LABEL.unagreed;
  return `${STATE_LABEL[element.state]}(${origin})`;
}

// 戻した要素の見出し。CR を反映した版の戻しは、CR の予測に無い変更を戻したもの
// (CR で書き換えてよいのは、対象の要件と保存した予測の画面・API だけのため)。戻していなければ null
export function restoredHeading(status: AgreementStatusRead): string | null {
  const { restored, version, change_request_number: cr } = status;
  if (restored.length === 0) return null;
  const changed = restored.filter((r) => r.reason === "changed").length;
  const breakdown = `書き換えを戻した ${changed}・落ちた要素を戻した ${restored.length - changed}`;
  if (cr != null) {
    return `この版(v${version}・CR-${cr} で反映)で、CR-${cr} の予測に無い変更を合意の形に戻しました: ${restored.length}件(${breakdown})`;
  }
  return `この版(v${version})の再生成で、合意の形に戻しました: ${restored.length}件(${breakdown})`;
}

// 履歴の1行の文(日時は画面で前に付ける)
export function historyEntryText(entry: HistoryEntryRead): string {
  if (entry.event === "restored") {
    const cr = entry.change_request_number != null ? `・CR-${entry.change_request_number} で反映` : "";
    return `${entry.doc_label ?? entry.doc_type ?? ""} v${entry.version}${cr}: ${entry.restore_reason_label ?? entry.event_label}`;
  }
  return entry.origin_label ? `${entry.event_label}(${entry.origin_label})` : entry.event_label;
}

// 関わる CR の関わり方(内容の変更などの対象 / 予測に入る)
export function relationText(cr: RelatedChangeRequestRead): string {
  const parts = [cr.status_label];
  if (cr.target_kind_label) parts.push(`対象: ${cr.target_kind_label}`);
  if (cr.predicted) parts.push("予測に入る");
  return parts.join("・");
}
