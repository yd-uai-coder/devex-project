// 作成：Phase-87-1｜更新：Phase-88-2,107-2,107-3,107-4,107-5,112-4
  // Phase-88-2：削除
  // BaselineRequirementRead,
  // BaselineSummaryRead,
  // Phase-88-2:追記
// Phase-107-2:追記 ── @/features/change-requests/api/types.ChangeRequestOptionsIn
// Phase-107-3:追記 ── @/features/change-requests/api/types.OptionDraftRead
// Phase-107-4:追記 ── @/features/change-requests/api/types.ShareLinkCreatedRead, @/features/change-requests/api/types.ShareLinkRead
// Phase-107-5:追記 ── @/features/change-requests/api/types.ChangeRequestCommentRead
import { apiFetch } from "@/lib/api/client";
import { fetchAttachment, parseFilename } from "@/lib/api/download";
import type {
  ChangeRequestCommentRead,
  ChangeRequestComparisonRead,
  ChangeRequestCreate,
  ChangeRequestDecision,
  ChangeRequestExplanationRead,
  ChangeRequestImpactRead,
  ChangeRequestOptionsIn,
  ChangeRequestRead,
  ChangeRequestSummaryRead,
  ChangeRequestTraceRead,
  ChangeRequestUpdate,
  ChangeRequestVerificationRead,
  OptionDraftRead,
  ReviewRunBriefRead,
  ShareLinkCreatedRead,
  ShareLinkRead,
} from "@/features/change-requests/api/types";

// Phase-88-2：更新
// // 変更要求(CR)の API(devex-api app/api/routes/change_requests.py)と、CR の作成で使う
// // 合意済みの版(束)の API(app/api/routes/baselines.py)。どれも詳細設計モードのプロジェクトだけ。
// ↓↓
// 変更要求(CR)の API(devex-api app/api/routes/change_requests.py)。詳細設計モードのプロジェクトだけ。
// CR の作成で使う合意済みの版(束)の API は features/baselines/api/baselinesApi.ts。
const base = (projectId: string) => `/api/v1/projects/${projectId}/change-requests`;
const one = (projectId: string, number: number) => `${base(projectId)}/${number}`;
const post = (body?: unknown): RequestInit => ({
  method: "POST",
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

export function listChangeRequests(projectId: string): Promise<ChangeRequestSummaryRead[]> {
  return apiFetch<ChangeRequestSummaryRead[]>(base(projectId));
}

// 下書きで作る。束が無いと409、基準の束の要件定義書に無い要件は422(CR_TARGET_UNKNOWN)
export function createChangeRequest(projectId: string, body: ChangeRequestCreate): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(base(projectId), post(body));
}

export function getChangeRequest(projectId: string, number: number): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(one(projectId, number));
}

// 下書き・説明済みの間だけ直せる(説明済みで直すと下書きに戻る)
export function updateChangeRequest(
  projectId: string,
  number: number,
  body: ChangeRequestUpdate,
): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(one(projectId, number), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

// Phase-107-2:追記
// 選択肢(案)だけを直す(下書き・説明済みの間だけ。説明済みは下書きに戻る)。案を消すときは items を空で送る。
// 案の規則か CR の対象に合わなければ422
export function updateChangeRequestOptions(
  projectId: string,
  number: number,
  options: ChangeRequestOptionsIn,
): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(one(projectId, number), {
    method: "PATCH",
    body: JSON.stringify({ options }),
  });
}

export function explainChangeRequest(projectId: string, number: number): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/explain`, post());
}

// Phase-112-4:追記
// 重なる CR の競合を、今の文と見比べて確かめた、にする(競合が無ければ409)
export function checkChangeRequestConflicts(projectId: string, number: number): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/conflict-checks`, post());
}

// 合意・却下(判断の時点の予測を CR に保存する)
export function decideChangeRequest(
  projectId: string,
  number: number,
  body: ChangeRequestDecision,
): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/decision`, post(body));
}

export function withdrawChangeRequest(projectId: string, number: number, reason: string): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/withdraw`, post({ reason }));
}

// 却下した CR を写して、新しい番号の下書きを作る(返るのは写しの先)
export function copyChangeRequest(projectId: string, number: number): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/copy`, post());
}

export function getChangeRequestImpact(projectId: string, number: number): Promise<ChangeRequestImpactRead> {
  return apiFetch<ChangeRequestImpactRead>(`${one(projectId, number)}/impact`);
}

// 反映の前は409(CR_NOT_APPLIED)
export function getChangeRequestComparison(
  projectId: string,
  number: number,
): Promise<ChangeRequestComparisonRead> {
  return apiFetch<ChangeRequestComparisonRead>(`${one(projectId, number)}/comparison`);
}

export function getChangeRequestVerification(
  projectId: string,
  number: number,
): Promise<ChangeRequestVerificationRead> {
  return apiFetch<ChangeRequestVerificationRead>(`${one(projectId, number)}/verification`);
}

// 文書の側(画面・API)の確認の項目を確認済み(reviewed=false で戻す)にする。反映済みの間だけ
export function checkChangeRequestDocuments(
  projectId: string,
  number: number,
  keys: string[],
  reviewed: boolean,
): Promise<ChangeRequestVerificationRead> {
  return apiFetch<ChangeRequestVerificationRead>(`${one(projectId, number)}/document-checks`, {
    method: "PUT",
    body: JSON.stringify({ keys, reviewed }),
  });
}

// 未確認が残っていれば409
export function verifyChangeRequest(projectId: string, number: number, note: string): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/verify`, post({ note }));
}

export function listReviewCandidates(projectId: string, number: number): Promise<ReviewRunBriefRead[]> {
  return apiFetch<ReviewRunBriefRead[]>(`${one(projectId, number)}/review-candidates`);
}

export function linkChangeRequestReview(
  projectId: string,
  number: number,
  reviewRunId: string,
): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/reviews`, post({ review_run_id: reviewRunId }));
}

export function getChangeRequestTrace(projectId: string, number: number): Promise<ChangeRequestTraceRead> {
  return apiFetch<ChangeRequestTraceRead>(`${one(projectId, number)}/trace`);
}

// Phase-88-2:追記
// 変更の説明書のプレビュー(5節・出力する md・要約と照合)
export function getExplanation(projectId: string, number: number): Promise<ChangeRequestExplanationRead> {
  return apiFetch<ChangeRequestExplanationRead>(`${one(projectId, number)}/explanation`);
}

// 要約を LLM で作る(作り直すと上書きし、未確認に戻る)。利用者の生成の用途のモデルで作る
export function createExplanationSummary(
  projectId: string,
  number: number,
): Promise<ChangeRequestExplanationRead> {
  return apiFetch<ChangeRequestExplanationRead>(`${one(projectId, number)}/explanation/summary`, post());
}

// 要約を直す(未確認に戻る)。要約が無ければ404(CR_SUMMARY_NOT_FOUND)
export function editExplanationSummary(
  projectId: string,
  number: number,
  text: string,
): Promise<ChangeRequestExplanationRead> {
  return apiFetch<ChangeRequestExplanationRead>(`${one(projectId, number)}/explanation/summary`, {
    method: "PATCH",
    body: JSON.stringify({ text }),
  });
}

// 要約を確かめた(誰が・いつを残す。照合で合わない所があっても押せる)
export function confirmExplanationSummary(
  projectId: string,
  number: number,
): Promise<ChangeRequestExplanationRead> {
  return apiFetch<ChangeRequestExplanationRead>(`${one(projectId, number)}/explanation/summary/confirm`, post());
}

// Phase-107-3:追記
// 選択肢の下書きを LLM で作る(説明書の md から2〜3の案とおすすめ。未確認でき、前の下書きは上書き)。
// 下書き・説明済みの間だけ。利用者の生成の用途のモデルで作る
export function createOptionDraft(projectId: string, number: number): Promise<OptionDraftRead> {
  return apiFetch<OptionDraftRead>(`${one(projectId, number)}/options/draft`, post());
}

// 下書きと照合の結果。下書きが無ければ404(CR_OPTION_DRAFT_NOT_FOUND)
export function getOptionDraft(projectId: string, number: number): Promise<OptionDraftRead> {
  return apiFetch<OptionDraftRead>(`${one(projectId, number)}/options/draft`);
}

// 下書きの案を CR の案に取り込む(説明済みは下書きに戻る)。取り込めない下書きは422
export function adoptOptionDraft(projectId: string, number: number): Promise<ChangeRequestRead> {
  return apiFetch<ChangeRequestRead>(`${one(projectId, number)}/options/draft/adopt`, post());
}

// Phase-107-4:追記
// 共有リンクを作る(下書きは説明済みになる。有効なリンクがあれば取り消してから作る)。期限は今からの日数(1〜90)。
// トークンはこの応答でだけ返る。下書き・説明済みでなければ409
export function createShareLink(projectId: string, number: number, expiresInDays: number): Promise<ShareLinkCreatedRead> {
  return apiFetch<ShareLinkCreatedRead>(`${one(projectId, number)}/share-links`, post({ expires_in_days: expiresInDays }));
}

// CR の共有リンク(新しい順。取り消したものも)
export function listShareLinks(projectId: string, number: number): Promise<ShareLinkRead[]> {
  return apiFetch<ShareLinkRead[]>(`${one(projectId, number)}/share-links`);
}

export function revokeShareLink(projectId: string, number: number, linkId: string): Promise<ShareLinkRead> {
  return apiFetch<ShareLinkRead>(`${one(projectId, number)}/share-links/${linkId}/revoke`, post());
}

// 期限を今から指定の日数後に置き直す。取り消したリンクは409
export function extendShareLink(
  projectId: string,
  number: number,
  linkId: string,
  expiresInDays: number,
): Promise<ShareLinkRead> {
  return apiFetch<ShareLinkRead>(
    `${one(projectId, number)}/share-links/${linkId}/extend`,
    post({ expires_in_days: expiresInDays }),
  );
}

// Phase-107-5:追記
// CR のコメント欄(クライアントのコメントごとに返信をまとめ、古い順。リンクを作り直しても残る)
export function listComments(projectId: string, number: number): Promise<ChangeRequestCommentRead[]> {
  return apiFetch<ChangeRequestCommentRead[]>(`${one(projectId, number)}/comments`);
}

// クライアントのコメントに返信する(返したコメントと返信の一覧が返る)。返信への返信は409
export function replyComment(
  projectId: string,
  number: number,
  commentId: string,
  body: string,
): Promise<ChangeRequestCommentRead> {
  return apiFetch<ChangeRequestCommentRead>(`${one(projectId, number)}/comments/${commentId}/replies`, post({ body }));
}

// 変更の説明書(md)。ファイル名はサーバーの Content-Disposition(cr-<番号>-explanation.md)
export async function downloadExplanation(
  projectId: string,
  number: number,
): Promise<{ filename: string; content: string }> {
  const res = await fetchAttachment(`${one(projectId, number)}/explanation/download`);
  const filename = parseFilename(res.headers.get("Content-Disposition")) ?? `cr-${number}-explanation.md`;
  return { filename, content: await res.text() };
}
// Phase-88-2：削除
//
// export function listBaselines(projectId: string): Promise<BaselineSummaryRead[]> {
//   return apiFetch<BaselineSummaryRead[]>(`/api/v1/projects/${projectId}/baselines`);
// }
//
// export function listBaselineRequirements(projectId: string, number: number): Promise<BaselineRequirementRead[]> {
//   return apiFetch<BaselineRequirementRead[]>(`/api/v1/projects/${projectId}/baselines/${number}/requirements`);
// }
