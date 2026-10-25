// 作成：Phase-108-1｜更新：Phase-108-2,108-3
// Phase-108-2:追記 ── @/features/share/api/types.SharedCommentCreate, @/features/share/api/types.SharedCommentRead
// Phase-108-3:追記 ── @/features/share/api/types.SharedDecisionCreate
import { apiFetch } from "@/lib/api/client";
import type {
  SharedChangeRequestRead,
  SharedCommentCreate,
  SharedCommentRead,
  SharedDecisionCreate,
} from "@/features/share/api/types";

// 共有リンクの公開の API(devex-api app/api/routes/share.py。ログインは要らない)。リンクが無ければ404、
// 期限切れ・取り消しは410、回数の上限は429
const base = (token: string) => `/api/v1/share/${encodeURIComponent(token)}`;

export function getSharedChangeRequest(token: string): Promise<SharedChangeRequestRead> {
  return apiFetch<SharedChangeRequestRead>(base(token));
}

// Phase-108-2:追記
// コメントする。開いていないリンクは409 SHARE_LINK_NOT_WRITABLE、見た版が古ければ409 SHARE_EXPLANATION_CHANGED、
// 書き込みの回数の上限は429
export function postSharedComment(token: string, body: SharedCommentCreate): Promise<SharedCommentRead> {
  return apiFetch<SharedCommentRead>(`${base(token)}/comments`, { method: "POST", body: JSON.stringify(body) });
}

// Phase-108-3:追記
// 合意・却下する(判断の後の閲覧の形が返る)。開いていないリンク(先に開発者が判断したときも)は409
// SHARE_LINK_NOT_WRITABLE、見た版が古ければ409 SHARE_EXPLANATION_CHANGED、理由の無い却下は422
export function postSharedDecision(token: string, body: SharedDecisionCreate): Promise<SharedChangeRequestRead> {
  return apiFetch<SharedChangeRequestRead>(`${base(token)}/decision`, { method: "POST", body: JSON.stringify(body) });
}
