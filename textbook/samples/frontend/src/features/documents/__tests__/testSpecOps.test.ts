// 作成：Phase-57-2｜更新：Phase-69-3
import { describe, expect, it } from "vitest";
import {
  countIssues,
  countText,
  filterIssues,
  issueRows,
  testSpecReadiness,
  testSpecStatus,
  zipTestSpecNote,
} from "../testSpecOps";
import { makeTestSpec } from "../test-utils/testSpecFixtures";
import { makeStages } from "@/features/detailed-design/test-utils/stageFixtures";

// SUT: testSpecOps の純粋関数 / ドライバ: このテスト /
// スタブ不要 ── 対象が純粋(副作用なし)で、応答の値だけから決まるため。

describe("testSpecOps", () => {
  it("状態は 無い=未作成・古い・作成済み", () => {
    expect(testSpecStatus(null)).toBe("none");
    expect(testSpecStatus(makeTestSpec({ outdated: true }))).toBe("outdated");
    expect(testSpecStatus(makeTestSpec())).toBe("ready");
  // Phase-69-3:追記
  });

  it("作っている間・直近の作成の失敗は、版の状態より先に出す", () => {
    expect(testSpecStatus(makeTestSpec(), { generating: true, failed: true })).toBe("generating");
    expect(testSpecStatus(makeTestSpec(), { failed: true })).toBe("failed");
    expect(testSpecStatus(null, { failed: true })).toBe("failed");
  });

  it("件数の文は、「設計に無い」があるときだけ後ろに足す", () => {
    expect(countText(makeTestSpec())).toBe("結合 12 件・総合 5 件");
    expect(countText(makeTestSpec({ design_gaps: 3 }))).toBe("結合 12 件・総合 5 件(「設計に無い」3 件)");
  });

  it("詳細設計モードは、段階1・段階7 が承認済みのときだけ作れる", () => {
    const none = testSpecReadiness(makeStages());
    expect(none.ready).toBe(false);
    expect(none.reason).toContain("段階1・7");

    const stage7Left = testSpecReadiness(makeStages({ 1: { state: "approved" }, 7: { state: "outdated" } }));
    expect(stage7Left.reason).toContain("段階7が");

    expect(testSpecReadiness(makeStages({ 1: { state: "approved" }, 7: { state: "approved" } }))).toEqual({
      ready: true,
      reason: null,
    });
  });

  it("zip の注記は、無い・古い・入る、の3通り", () => {
    expect(zipTestSpecNote(null)).toContain("まだ無い");
    expect(zipTestSpecNote(makeTestSpec({ outdated: true }))).toContain("古いため");
    expect(zipTestSpecNote(makeTestSpec())).toContain("test_spec.md");
  });

  it("指摘の行は、対象を別の列にし、内容から末尾の対象を除く", () => {
    const rows = issueRows(makeTestSpec().issues);

    expect(rows[0]).toEqual({ level: "major", targets: "FR-007", content: "テストの無い Must の機能要件" });
    expect(rows[1].targets).toBe("GET /api/v1/items・DELETE /api/v1/items/{id}");
    expect(rows[1].content).toBe("異常系のテストが無い API");
    // 対象の無い指摘・形の違う message はそのまま
    expect(issueRows([{ level: "minor", code: "X", message: "そのまま", targets: [] }])[0]).toEqual({
      level: "minor",
      targets: "—",
      content: "そのまま",
    });
  });

  it("重要度ごとに数え、絞り込む", () => {
    const rows = issueRows(makeTestSpec().issues);

    expect(countIssues(rows)).toEqual({ critical: 0, major: 1, minor: 1 });
    expect(filterIssues(rows, "minor")).toHaveLength(1);
    expect(filterIssues(rows, "all")).toHaveLength(2);
  });
});
