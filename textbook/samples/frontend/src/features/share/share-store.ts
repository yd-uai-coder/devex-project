// 作成：Phase-108-1｜更新：Phase-108-2,108-3
// Phase-108-2:追記 ── @/features/share/api/sharedApi.postSharedComment, @/features/share/shareOps.isExplanationChanged, @/features/share/shareOps.loadClientName, @/features/share/shareOps.saveClientName
// Phase-108-3:追記 ── @/features/share/api/sharedApi.postSharedDecision, @/features/share/shareOps.isNotWritable
import { create } from "zustand";
import type { AsyncStatus } from "@/lib/api/types";
import { getSharedChangeRequest, postSharedComment, postSharedDecision } from "@/features/share/api/sharedApi";
import type { SharedChangeRequestRead } from "@/features/share/api/types";
import {
  isExplanationChanged,
  isLinkUnavailable,
  isNotWritable,
  loadClientName,
  saveClientName,
  shareFailureMessage,
} from "@/features/share/shareOps";

// 共有リンクの画面(SCR-012)の状態。開いたトークンの CR の閲覧の形だけを持つ(ログインの要らないページで、
// 開発者のストアとは分ける)。読み直しは手で行う(公開の入口は回数の上限があるため、自動では読まない)
type ShareStore = {
  token: string | null;
  shared: SharedChangeRequestRead | null;
  status: AsyncStatus;
  error: string | null;
  // リンクそのものが使えない(無い・期限切れ・取り消し)。読み直しのボタンを出さない
  unavailable: boolean;
  load: (token: string) => Promise<void>;
  // Phase-108-2:追記
  // クライアントの名前(ページに1つ。コメントと合意 / 却下で使い、このブラウザに覚える)
  name: string;
  restoreName: () => void;
  setName: (name: string) => void;
  // 開いた後に説明書が新しくなった(書き込みが409で返った)。読み直すまで知らせる
  explanationChanged: boolean;
  commenting: boolean;
  commentError: string | null;
  // コメントする(見た説明書の版を添える)。送れたら true(書いた本文を消してよい)
  comment: (body: string) => Promise<boolean>;
  // Phase-108-3:追記
  deciding: "agreed" | "rejected" | null;
  decisionError: string | null;
  // 合意・却下する(名前と見た説明書の版を添える)。記録できたら、判断の後の閲覧の形に置き換えて true
  decide: (input: { decision: "agreed" | "rejected"; option: number | null; reason: string }) => Promise<boolean>;
};

export const useShareStore = create<ShareStore>((set, get) => ({
  token: null,
  shared: null,
  status: "idle",
  error: null,
  unavailable: false,
  // Phase-108-2:追記
  name: "",
  explanationChanged: false,
  commenting: false,
  commentError: null,
  // Phase-108-3:追記
  deciding: null,
  decisionError: null,

  load: async (token) => {
    // 別のリンクを開いたら、前の中身を捨てる
    if (get().token !== token) set({ token, shared: null });
    // Phase-108-2：更新
    // set({ status: "loading", error: null, unavailable: false });
    // ↓↓
    // Phase-108-3：更新
    // set({ status: "loading", error: null, unavailable: false, explanationChanged: false, commentError: null });
    // ↓↓
    set({ status: "loading", error: null, unavailable: false, explanationChanged: false, commentError: null, decisionError: null });
    try {
      const shared = await getSharedChangeRequest(token);
      if (get().token !== token) return;
      set({ shared, status: "success" });
    } catch (err) {
      if (get().token !== token) return;
      set({
        status: "error",
        error: shareFailureMessage(err, "読み込めませんでした"),
        unavailable: isLinkUnavailable(err),
        ...(isLinkUnavailable(err) ? { shared: null } : {}),
      });
    }
  },

  // Phase-108-2:追記
  // 覚えた名前は、描いた後に読む(サーバーの描画とずれないように)
  restoreName: () => {
    if (!get().name) set({ name: loadClientName() });
  },

  setName: (name) => {
    set({ name });
    saveClientName(name);
  },

  comment: async (body) => {
    const { token, shared, name } = get();
    if (token === null || shared?.fingerprint == null) return false;
    set({ commenting: true, commentError: null });
    try {
      const created = await postSharedComment(token, { name: name.trim(), body, fingerprint: shared.fingerprint });
      const current = get().shared;
      if (get().token === token && current) {
        set({ shared: { ...current, comments: [...current.comments, created] } });
      }
      set({ commenting: false });
      return true;
    } catch (err) {
      set({
        commenting: false,
        commentError: shareFailureMessage(err, "コメントを送れませんでした"),
        ...(isExplanationChanged(err) ? { explanationChanged: true } : {}),
      });
      return false;
    }
  },

  // Phase-108-3:追記
  decide: async ({ decision, option, reason }) => {
    const { token, shared, name } = get();
    if (token === null || shared?.fingerprint == null) return false;
    set({ deciding: decision, decisionError: null });
    try {
      const decided = await postSharedDecision(token, {
        decision,
        name: name.trim(),
        fingerprint: shared.fingerprint,
        option: decision === "agreed" ? option : null,
        reason: reason.trim(),
      });
      if (get().token === token) set({ shared: decided });
      set({ deciding: null });
      return true;
    } catch (err) {
      const message = shareFailureMessage(err, "記録できませんでした");
      set({ deciding: null });
      // 先に開発者が判断した・直し始めたときは、読み直して今の状態(判断の結果など)を出す
      if (isNotWritable(err)) await get().load(token);
      set({ decisionError: message, ...(isExplanationChanged(err) ? { explanationChanged: true } : {}) });
      return false;
    }
  },
}));
