// 作成：Phase-97-2
// SUT: agreementOps(行の合意の画面の表示の文を決める純粋関数)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
import { describe, expect, it } from "vitest";
import {
  elementBadge,
  historyEntryText,
  relationText,
  restoredHeading,
  stateCountsText,
} from "../agreementOps";
import { makeElement, makeHistory, makeStatus } from "../test-utils/agreementFixtures";

describe("agreementOps", () => {
  it("状態ごとの件数。今の版に無いは1件以上のときだけ", () => {
    expect(stateCountsText(makeStatus().elements)).toBe("合意済み 2 / 合意と違う 0 / 未合意 1");
    const missing = makeElement({ key: "req:FR-004", state: "missing" });
    expect(stateCountsText([missing])).toBe("合意済み 0 / 合意と違う 0 / 未合意 0 / 今の版に無い 1");
  });

  it("要素の印は出どころつき", () => {
    expect(elementBadge(makeElement())).toBe("合意 B-1");
    expect(elementBadge(makeElement({ state: "differs", origin_label: "CR-3" }))).toBe("合意と違う(合意 CR-3)");
    expect(elementBadge(makeElement({ state: "missing" }))).toBe("今の版に無い(合意 B-1)");
    expect(elementBadge(makeElement({ state: "unagreed", origin_label: null }))).toBe("未合意");
  });

  it("戻した要素の見出しは、CR を反映した版なら予測に無い変更と言い分ける", () => {
    const restored = [
      { key: "req:FR-001", label: "FR-001", reason: "changed" as const, reason_label: "書き換えを戻した" },
      { key: "req:FR-002", label: "FR-002", reason: "dropped" as const, reason_label: "落ちた要素を戻した" },
    ];
    expect(restoredHeading(makeStatus())).toBeNull();
    expect(restoredHeading(makeStatus({ version: 7, change_request_number: 3, restored }))).toBe(
      "この版(v7・CR-3 で反映)で、CR-3 の予測に無い変更を合意の形に戻しました: 2件(書き換えを戻した 1・落ちた要素を戻した 1)",
    );
    expect(restoredHeading(makeStatus({ version: 4, restored: restored.slice(1) }))).toBe(
      "この版(v4)の再生成で、合意の形に戻しました: 1件(書き換えを戻した 0・落ちた要素を戻した 1)",
    );
  });

  it("履歴の1行と、関わる CR の関わり方", () => {
    const [agreed, restored] = makeHistory().entries;
    expect(historyEntryText(agreed)).toBe("合意(B-1)");
    expect(historyEntryText(restored)).toBe("要件定義書 v3・CR-2 で反映: 書き換えを戻した");
    expect(historyEntryText({ ...restored, change_request_number: null })).toBe("要件定義書 v3: 書き換えを戻した");

    const [cr] = makeHistory().change_requests;
    expect(relationText(cr)).toBe("検証済み・対象: 内容の変更");
    expect(relationText({ ...cr, target_kind_label: null, predicted: true })).toBe("検証済み・予測に入る");
  });
});
