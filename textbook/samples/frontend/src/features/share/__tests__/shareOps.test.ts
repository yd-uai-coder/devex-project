// 作成：Phase-108-1｜更新：Phase-108-2,108-3
// Phase-108-2：更新
// // SUT: shareOps(状態の知らせ・書き込めるか・失敗の文・リンクが使えないか)
// ↓↓
// SUT: shareOps(状態の知らせ・書き込めるか・失敗の文・リンクが使えないか・名前の覚えと確かめ)
// ドライバ: vitest のテスト関数
// Phase-108-2：更新
// // スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
// ↓↓
// スタブ不要 ── 対象は純粋(副作用なし)で外部依存を呼ばないため。名前の覚えだけは localStorage に触るので、
// 覚えられないブラウザを vi.spyOn で作る
// Phase-108-2:追記 ── vitest.afterEach, vitest.vi, ../shareOps.CLIENT_NAME_MAX, ../shareOps.isExplanationChanged, ../shareOps.loadClientName, ../shareOps.nameProblem, ../shareOps.saveClientName
// Phase-108-3:追記 ── ../shareOps.decisionProblem, ../shareOps.isNotWritable
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  CLIENT_NAME_MAX,
  decisionProblem,
  isExplanationChanged,
  isLinkUnavailable,
  isNotWritable,
  isWritable,
  loadClientName,
  nameProblem,
  saveClientName,
  shareFailureMessage,
  stateNotice,
} from "../shareOps";
import { makeHiddenShared, makeShared } from "../test-utils/sharedFixtures";

describe("shareOps", () => {
  it("状態ごとの知らせ(期限切れ・取り消しは失敗の側なので空)", () => {
    expect(stateNotice("open")).toContain("合意か却下か");
    expect(stateNotice("paused")).toContain("直しています");
    expect(stateNotice("closed")).toContain("取り下げ");
    expect(stateNotice("expired")).toBe("");
  });

  it("書き込めるのは開いているリンクだけ", () => {
    expect(isWritable(makeShared())).toBe(true);
    expect(isWritable(makeShared({ state: "decided", state_label: "判断済み" }))).toBe(false);
    expect(isWritable(makeHiddenShared("paused"))).toBe(false);
  });

  it("リンクが無い・期限切れ・取り消し・回数の上限・説明書の変化を分けて伝える", () => {
    expect(shareFailureMessage(new ApiError(404, "Share link not found", "SHARE_LINK_NOT_FOUND"), "x")).toContain(
      "見つかりません",
    );
    expect(shareFailureMessage(new ApiError(410, "…", "SHARE_LINK_EXPIRED"), "x")).toContain("期限が切れました");
    expect(shareFailureMessage(new ApiError(410, "…", "SHARE_LINK_REVOKED"), "x")).toContain("使えなくなりました");
    expect(shareFailureMessage(new ApiError(429, "Too many"), "x")).toContain("しばらく待って");
    expect(shareFailureMessage(new ApiError(409, "…", "SHARE_EXPLANATION_CHANGED"), "x")).toContain("新しくなりました");
    expect(shareFailureMessage(new ApiError(409, "…", "SHARE_LINK_NOT_WRITABLE"), "x")).toContain("受け付けていません");
    expect(shareFailureMessage(new ApiError(422, "却下の理由を書いてください。"), "x")).toBe("却下の理由を書いてください。");
    expect(shareFailureMessage(new Error("network"), "読み込めませんでした")).toBe("読み込めませんでした");
  });

  it("404・410 はリンクそのものが使えない(429 は読み直せる)", () => {
    expect(isLinkUnavailable(new ApiError(404, ""))).toBe(true);
    expect(isLinkUnavailable(new ApiError(410, ""))).toBe(true);
    expect(isLinkUnavailable(new ApiError(429, ""))).toBe(false);
  });

  // Phase-108-2:追記
  describe("名前", () => {
    afterEach(() => {
      vi.restoreAllMocks();
      window.localStorage.clear();
    });

    it("覚えた名前を読み、空にすると忘れる", () => {
      saveClientName("山田");
      expect(loadClientName()).toBe("山田");

      saveClientName("  ");
      expect(loadClientName()).toBe("");
    });

    it("覚えられないブラウザでも失敗しない", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });

      expect(() => saveClientName("山田")).not.toThrow();
      expect(loadClientName()).toBe("");
    });

    it("名前は空白だけでも上限を超えても送れない", () => {
      expect(nameProblem(" ")).toContain("お名前を入れて");
      expect(nameProblem("あ".repeat(CLIENT_NAME_MAX + 1))).toContain(`${CLIENT_NAME_MAX}文字まで`);
      expect(nameProblem("山田")).toBeNull();
    });
  });

  it("説明書が新しくなった失敗を見分ける", () => {
    expect(isExplanationChanged(new ApiError(409, "", "SHARE_EXPLANATION_CHANGED"))).toBe(true);
    expect(isExplanationChanged(new ApiError(409, "", "SHARE_LINK_NOT_WRITABLE"))).toBe(false);
  });

  // Phase-108-3:追記
  it("判断は名前が要り、案のある合意は案を、却下は理由を求める", () => {
    const base = { decision: "agreed" as const, name: "山田", option: null, reason: "", optionCount: 0 };
    expect(decisionProblem(base)).toBeNull();
    expect(decisionProblem({ ...base, name: "" })).toContain("お名前");
    expect(decisionProblem({ ...base, optionCount: 2 })).toContain("案を選んで");
    expect(decisionProblem({ ...base, optionCount: 2, option: 2 })).toBeNull();
    expect(decisionProblem({ ...base, decision: "rejected", optionCount: 2 })).toContain("却下の理由");
    expect(decisionProblem({ ...base, decision: "rejected", reason: "今は要らない" })).toBeNull();
  });

  it("リンクが開いていないための失敗を見分ける", () => {
    expect(isNotWritable(new ApiError(409, "", "SHARE_LINK_NOT_WRITABLE"))).toBe(true);
    expect(isNotWritable(new ApiError(409, "", "SHARE_EXPLANATION_CHANGED"))).toBe(false);
  });
});
