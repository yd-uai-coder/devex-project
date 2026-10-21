// 作成：Phase-98-1
// SUT: confirmationOps(確認事項の一覧の絞り込み・分け方・採用率の文・確認のダイアログの要否)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER,
  adoptionText,
  filterItems,
  needsAdoptConfirm,
  splitByPresence,
  unconfirmedCountsText,
} from "../confirmationOps";
import { makeItem, makeList } from "../test-utils/confirmationFixtures";

describe("confirmationOps", () => {
  it("今の一覧の項目と、一覧から消えた項目に分ける", () => {
    const { present, gone } = splitByPresence(makeList().items);

    expect(present.map((i) => i.key)).toEqual(["req:FR-004", "user:管理者", "point:scale"]);
    expect(gone.map((i) => i.key)).toEqual(["req:FR-009"]);
  });

  it("種類と状態で絞る(既定は未確認だけ)", () => {
    const items = [makeItem(), makeItem({ key: "req:FR-005", status: "rejected" }), makeItem({ key: "point:x", kind: "point" })];

    expect(filterItems(items, DEFAULT_FILTER).map((i) => i.key)).toEqual(["req:FR-004", "point:x"]);
    expect(filterItems(items, { kind: "point", status: "all" }).map((i) => i.key)).toEqual(["point:x"]);
    expect(filterItems(items, { kind: "all", status: "all" })).toHaveLength(3);
  });

  it("未確認の件数は種類ごとに、今の一覧の項目だけ数える", () => {
    expect(unconfirmedCountsText(makeList().items)).toBe("推測の要件 1 / 推測の利用者 1 / 未決の観点 1");
  });

  it("採用率は百分率で、分母が0なら「─」", () => {
    expect(adoptionText({ confirmed: 3, rejected: 1, unconfirmed: 5, rate: 0.75 })).toBe(
      "推測の採用率: 75%(確認済み 3 / 却下 1・未確認 5)",
    );
    expect(adoptionText({ confirmed: 0, rejected: 0, unconfirmed: 2, rate: null })).toBe(
      "推測の採用率: ─(確認済み 0 / 却下 0・未確認 2)",
    );
  });

  it("確認のダイアログは、推測の要件・利用者を確認済みにするときだけ", () => {
    expect(needsAdoptConfirm(makeItem(), "confirmed")).toBe(true);
    expect(needsAdoptConfirm(makeItem({ kind: "user" }), "confirmed")).toBe(true);
    expect(needsAdoptConfirm(makeItem({ kind: "point" }), "confirmed")).toBe(false);
    expect(needsAdoptConfirm(makeItem(), "rejected")).toBe(false);
    // 既に確認済みの行・一覧から消えた行は採用にならない
    expect(needsAdoptConfirm(makeItem({ status: "confirmed" }), "confirmed")).toBe(false);
    expect(needsAdoptConfirm(makeItem({ present: false }), "confirmed")).toBe(false);
  });
});
