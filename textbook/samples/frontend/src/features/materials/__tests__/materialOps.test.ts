// 作成：Phase-116-1｜更新：Phase-116-2,116(完了後の調整)
// SUT: materialOps(資料の画面の純粋な変換)
// ドライバ: vitest のテスト関数
// スタブ不要 ── 対象が純粋(副作用なし)で外部依存を呼ばないため
// Phase-116-2:追記 ── ../materialOps.materialFormBlocker, ../materialOps.toMaterialInput, ../materialOps.todayInput, ../materialOps.MaterialForm
import { describe, expect, it } from "vitest";
import {
  choosesRequirements,
  elementLabel,
  groupDifferences,
  isDraftable,
  isExtractionOutdated,
  materialErrorMessage,
  materialHref,
  materialFormBlocker,
  materialsHref,
  requirementIdsFor,
  toMaterialInput,
  todayInput,
  type MaterialForm,
  withoutRequirement,
} from "../materialOps";
import { makeDifference, makeDifferences } from "../test-utils/materialFixtures";
import { ApiError } from "@/lib/api/client";

const screenChange = makeDifference({
  id: "d2",
  target_key: "screen:SCR-001",
  requirement_candidates: ["FR-003", "FR-004"],
});

describe("materialOps", () => {
  it("リンクと要素のキーの見せ方", () => {
    expect(materialsHref("p1")).toBe("/projects/p1/materials");
    expect(materialHref("p1", "m1")).toBe("/projects/p1/materials/m1");
    expect(elementLabel("req:FR-001")).toBe("FR-001");
    expect(elementLabel("integration:INT-001")).toBe("INT-001");
    expect(elementLabel("users")).toBe("利用者と使う場面");
    expect(elementLabel("")).toBe("");
  });

  // Phase-116-2:追記
  it("足すフォームは、題・本文の長さ・ファイルの形式と大きさを送る前に止める", () => {
    const form: MaterialForm = {
      kind: "minutes",
      title: " 議事録 ",
      materialDate: "2026-11-16",
      source: "paste",
      body: " 本文 ",
      file: null,
    };
    expect(todayInput(new Date(2026, 0, 5))).toBe("2026-01-05");
    // Phase-116(完了後の調整)：更新
    // expect(materialFormBlocker({ ...form, title: " " })).toBe("題を書いてください。");
    // ↓↓
    expect(materialFormBlocker({ ...form, title: " " })).toBe("タイトルを書いてください。");
    expect(materialFormBlocker({ ...form, body: "あ".repeat(20_001) })).toContain("本文が長すぎます(20001文字");
    expect(materialFormBlocker({ ...form, source: "file" })).toBe("ファイルを選んでください。");
    expect(materialFormBlocker({ ...form, source: "file", file: new File(["x"], "a.docx") })).toContain("txt・md・pdf");
    const big = new File(["x"], "a.pdf");
    Object.defineProperty(big, "size", { value: 2 * 1024 * 1024 + 1 });
    expect(materialFormBlocker({ ...form, source: "file", file: big })).toContain("2MB");
    expect(toMaterialInput(form)).toEqual({
      meta: { kind: "minutes", title: "議事録", material_date: "2026-11-16" },
      body: "本文",
    });
    const file = new File(["# x"], "a.md");
    expect(toMaterialInput({ ...form, source: "file", file })).toEqual({
      meta: { kind: "minutes", title: "議事録", material_date: "2026-11-16" },
      file,
    });
    expect(toMaterialInput({ ...form, title: "" })).toBeNull();
  });

  it("違いを状態で分け、未確認を上に、群の中は API の順のまま", () => {
    const groups = groupDifferences([
      makeDifference({ id: "a", status: "rejected" }),
      makeDifference({ id: "b" }),
      makeDifference({ id: "c", status: "converted", change_request_number: 8 }),
      makeDifference({ id: "d", kind: "question" }),
    ]);
    expect(groups.map((g) => [g.label, g.items.map((d) => d.id)])).toEqual([
      ["未確認", ["b", "d"]],
      ["CR にした", ["c"]],
      ["弾いた", ["a"]],
    ]);
  });

  it("CR にできるのは未確認の追加・変更・削除。要件を選ぶのは要件でない対象で候補があるもの", () => {
    expect(isDraftable(makeDifference())).toBe(true);
    expect(isDraftable(makeDifference({ kind: "question" }))).toBe(false);
    expect(isDraftable(makeDifference({ status: "dismissed" }))).toBe(false);
    expect(choosesRequirements(screenChange)).toBe(true);
    expect(choosesRequirements(makeDifference())).toBe(false);
    expect(choosesRequirements(makeDifference({ target_key: "screen:SCR-009" }))).toBe(false);
  });

  it("外した要件が無ければ requirement_ids を省き、あれば残った候補を送る。全部外した違いを見つける", () => {
    const selected = [makeDifference(), screenChange];
    expect(requirementIdsFor(selected, {})).toBeUndefined();
    expect(requirementIdsFor(selected, { d2: ["FR-004"] })).toEqual(["FR-003"]);
    expect(withoutRequirement(selected, { d2: ["FR-004"] })).toEqual([]);
    expect(withoutRequirement(selected, { d2: ["FR-003", "FR-004"] }).map((d) => d.id)).toEqual(["d2"]);
  });

  it("取り出した後に束を作り直したかを見る", () => {
    expect(isExtractionOutdated(makeDifferences())).toBe(false);
    expect(isExtractionOutdated(makeDifferences({ latest_baseline_number: 3 }))).toBe(true);
    expect(isExtractionOutdated(makeDifferences({ extraction: null }))).toBe(false);
  });

  it("失敗の文は、取り出し直し・束が無いときに案内を足し、ほかはサーバーの文", () => {
    expect(materialErrorMessage(new ApiError(409, "x", "MATERIAL_DIFFERENCE_OUTDATED"), "f")).toContain("取り出し直して");
    expect(materialErrorMessage(new ApiError(409, "x", "MATERIAL_BASELINE_MISSING"), "f")).toContain("合意済みの版を作って");
    expect(materialErrorMessage(new ApiError(422, "本文が長すぎます"), "f")).toBe("本文が長すぎます");
    expect(materialErrorMessage("?", "失敗")).toBe("失敗");
  });
});
