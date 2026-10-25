// 作成：Phase-98-1｜更新：Phase-99(完了後の調整),109-3
// Phase-99(完了後の調整)：更新
// // SUT: confirmationOps(確認事項の一覧の絞り込み・分け方・採用率の文・確認のダイアログの要否)
// ↓↓
// Phase-109-3：更新
// // SUT: confirmationOps(確認事項の一覧の絞り込み・行の状態を変えられるか・採用率の文・確認のダイアログの要否)
// ↓↓
// SUT: confirmationOps(確認事項の一覧の絞り込み・行の状態を変えられるか・採用率の文・確認のダイアログの要否・
//      CR で変わった旨の文)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
// Phase-99(完了後の調整):追記 ── ../confirmationOps.rowLock
// Phase-99(完了後の調整)：削除 ── ../confirmationOps.splitByPresence
// Phase-109-3:追記 ── ../confirmationOps.changedByLabel
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER,
  adoptionText,
  changedByLabel,
  filterItems,
  needsAdoptConfirm,
  rowLock,
  unconfirmedCountsText,
} from "../confirmationOps";
import { makeItem, makeList } from "../test-utils/confirmationFixtures";

describe("confirmationOps", () => {
  // Phase-109-3:追記
  it("CR の反映で未確認に戻った行だけ、どの CR で変わったかの文を作る", () => {
    expect(changedByLabel(makeItem())).toBeNull();
    expect(changedByLabel(makeItem({ changed_by_change_request_number: 3 }))).toBe("CR-3 の反映で文が変わりました");
  });

  // Phase-99(完了後の調整)：更新
  // it("今の一覧の項目と、一覧から消えた項目に分ける", () => {
  //   const { present, gone } = splitByPresence(makeList().items);
  // ↓↓
  it("今の一覧に無い行は状態を変えられず、採用して合意した要件・利用者は変更要求へ案内する", () => {
    expect(rowLock(makeItem())).toEqual({ locked: false });
    expect(rowLock(makeItem({ present: false, status: "confirmed" }))).toEqual({
      locked: true,
      label: "確認済み(採用して合意)",
      viaChangeRequest: true,
    });
    expect(rowLock(makeItem({ key: "user:管理者", kind: "user", present: false, status: "confirmed" }))).toMatchObject({
      viaChangeRequest: true,
    });
    // 観点・却下の行は採用にしていないので、理由だけ(変更要求は要らない)
    expect(rowLock(makeItem({ key: "point:x", kind: "point", present: false, status: "confirmed" }))).toEqual({
      locked: true,
      label: "確認済み(今の一覧に無い)",
      viaChangeRequest: false,
    });
    expect(rowLock(makeItem({ present: false, status: "rejected" }))).toMatchObject({
      label: "却下(今の一覧に無い)",
      viaChangeRequest: false,
    });
  });

  // Phase-99(完了後の調整)：更新
  //   expect(present.map((i) => i.key)).toEqual(["req:FR-004", "user:管理者", "point:scale"]);
  //   expect(gone.map((i) => i.key)).toEqual(["req:FR-009"]);
  // ↓↓
  it("絞り込みは今の一覧に無い項目にも同じく当たる", () => {
    const items = makeList().items;

    expect(filterItems(items, DEFAULT_FILTER).map((i) => i.key)).toEqual(["req:FR-004", "user:管理者", "point:scale"]);
    expect(filterItems(items, { kind: "all", status: "confirmed" }).map((i) => i.key)).toEqual(["req:FR-009"]);
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
