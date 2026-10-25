// 作成：Phase-108-1｜更新：Phase-108-2,108-3
import { ApiError } from "@/lib/api/client";
import type { ShareState } from "@/features/change-requests/api/types";
import type { SharedChangeRequestRead } from "@/features/share/api/types";

// 開いた共有リンクの状態ごとに、クライアントへ伝える文(期限切れ・取り消しは API が410で返すので
// shareFailureMessage の側)
const STATE_NOTICE: Partial<Record<ShareState, string>> = {
  open: "説明書を読んで、合意か却下かをお知らせください。分からない点はコメントで質問できます。",
  paused: "開発者がこの変更の内容を直しています。直し終わると、このリンクで続きを読めます。",
  decided: "この変更は判断済みです。",
  closed: "この変更は取り下げられました。",
};

export function stateNotice(state: ShareState): string {
  return STATE_NOTICE[state] ?? "";
}

// コメント・合意 / 却下を書き込めるか(開いているリンクだけ。devex-api の WRITABLE_STATES と同じ)
export function isWritable(shared: SharedChangeRequestRead): boolean {
  return shared.state === "open" && shared.fingerprint !== null;
}

// 読み込み・書き込みの失敗をクライアント向けの文にする。リンクが無い(簡易ドキュメントモードの CR も)・
// 期限切れ・取り消しを分けて伝える(期限切れなら延長を頼める)
export function shareFailureMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 404) return "このリンクは見つかりません。URL を確かめるか、開発者に問い合わせてください。";
  if (err.code === "SHARE_LINK_EXPIRED") {
    return "このリンクは期限が切れました。開発者に新しいリンクか延長を頼んでください。";
  }
  if (err.code === "SHARE_LINK_REVOKED") {
    return "このリンクは使えなくなりました。開発者に今のリンクを確かめてください。";
  }
  if (err.status === 429) return "短い間に操作が多すぎます。しばらく待ってから、もう一度開いてください。";
  if (err.code === "SHARE_EXPLANATION_CHANGED") {
    return "説明書が新しくなりました。読み直してから、もう一度送ってください。";
  }
  if (err.code === "SHARE_LINK_NOT_WRITABLE") {
    return "この変更は今、書き込みを受け付けていません(直している・判断済みなど)。読み直して確かめてください。";
  }
  return err.message || fallback;
}

// 読み込みの失敗が、リンクそのものが使えない(読み直しても変わらない)ものか
export function isLinkUnavailable(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 404 || err.status === 410);
}

export const formatDateTime = (iso: string) => new Date(iso).toLocaleString("ja-JP");
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ja-JP");

// Phase-108-2:追記
// 名前の上限(devex-api app/schemas/agreement.py の COUNTERPART_MAX。コメントの本文の上限は、開発者の返信と同じ
// changeRequestOps の COMMENT_BODY_MAX)
export const CLIENT_NAME_MAX = 200;

// クライアントの名前を、このブラウザに覚えておく鍵(次に開いたときに入っている。覚えられなくても動く)
const NAME_STORAGE_KEY = "devex.share.clientName";

export function loadClientName(): string {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveClientName(name: string): void {
  try {
    if (name.trim()) window.localStorage.setItem(NAME_STORAGE_KEY, name);
    else window.localStorage.removeItem(NAME_STORAGE_KEY);
  } catch {
    // プライベートウィンドウなどで覚えられなくても、入力した名前はページの中で使える
  }
}

// 名前の確かめ(コメント・合意 / 却下の両方で要る)
export function nameProblem(name: string): string | null {
  if (!name.trim()) return "お名前を入れてください";
  if (name.trim().length > CLIENT_NAME_MAX) return `お名前は${CLIENT_NAME_MAX}文字までにしてください`;
  return null;
}

// Phase-108-3:追記
// 判断の理由の上限(devex-api app/schemas/agreement.py の REASON_MAX)
export const DECISION_REASON_MAX = 2000;

// 判断の入力の確かめ。名前は要り、却下は理由が要り、案のある CR の合意は案を選ぶ(初めは選ばない。
// 開発者の合意のダイアログと同じ)
export function decisionProblem(input: {
  decision: "agreed" | "rejected";
  name: string;
  option: number | null;
  reason: string;
  optionCount: number;
}): string | null {
  const nameIssue = nameProblem(input.name);
  if (nameIssue) return nameIssue;
  if (input.decision === "agreed" && input.optionCount > 0 && input.option === null) return "合意する案を選んでください";
  if (input.decision === "rejected" && !input.reason.trim()) return "却下の理由を書いてください";
  return null;
}

// 書き込みが、リンクが開いていないために断られたか(先に開発者が判断した・直し始めたなど。読み直して今の状態を出す)
export function isNotWritable(err: unknown): boolean {
  return err instanceof ApiError && err.code === "SHARE_LINK_NOT_WRITABLE";
}

// 書き込みの失敗が、開いた後に説明書が新しくなったためか(読み直してもらう)
export function isExplanationChanged(err: unknown): boolean {
  return err instanceof ApiError && err.code === "SHARE_EXPLANATION_CHANGED";
}
