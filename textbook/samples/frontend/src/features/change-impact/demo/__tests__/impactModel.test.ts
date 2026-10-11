// 作成：Phase-41-3
import { describe, expect, it } from "vitest";
import { DEMO_CHANGES, DEMO_ELEMENTS } from "../demoData";
import {
  canReapprove,
  impactOf,
  outdatedStages,
  pathText,
  regenerationTargets,
  stageMarks,
  type Change,
  type DesignElement,
} from "../impactModel";

const change = (id: string): Change => {
  const found = DEMO_CHANGES.find((c) => c.id === id);
  if (!found) throw new Error(id);
  return found;
};
const keys = (c: Change) => impactOf(DEMO_ELEMENTS, c).map((i) => i.key);

describe("impactOf", () => {
  it("要件の変更は、それを持つ処理に属する要素まで届き、別の処理には広げない", () => {
    const result = keys(change("fr"));

    expect(result).toEqual(
      expect.arrayContaining([
        "SCR-002",
        "API POST /api/v1/chats",
        "F-02",
        "DFD F-02",
        "CRUD F-02×chats",
        "PROC F-02",
        "LOGIC ChatService.send_message",
        "TASK M-02-T01",
        "UNIT M-02-T01",
      ]),
    );
    expect(result).toHaveLength(9);
    // 共有のモジュール(clients/ai.py)を通って F-03 の要素へは広げない
    expect(result).not.toContain("PROC F-03");
    expect(result).not.toContain("MOD clients/ai.py");
  });

  it("処理に属する要素は、変わった要素からの道と参照の種類の理由を持つ", () => {
    const logic = impactOf(DEMO_ELEMENTS, change("fr")).find((i) => i.key === "LOGIC ChatService.send_message");

    expect(logic && pathText(logic.path)).toBe("FR-011 → F-02 → PROC F-02 → LOGIC ChatService.send_message");
    expect(logic?.reason).toBe("この手順から呼ばれる");
  });

  it("非機能要件の変更は、要件ID を持つ横断事項と、その対象のモジュールを含む手順書に届く", () => {
    expect(keys(change("nfr"))).toEqual(["CC 認証", "UNIT M-01-T01"]);
  });

  it("処理の変更は、その処理に直接依存する要素(モジュールを含む)と、処理ロジック・手順書に届く", () => {
    const result = keys(change("function"));

    expect(result).toEqual(
      expect.arrayContaining([
        "DFD F-03",
        "CRUD F-03×projects",
        "CRUD F-03×documents",
        "MOD clients/ai.py",
        "PROC F-03",
        "LOGIC DocumentService.generate_documents",
        "TASK M-03-T01",
        "UNIT M-03-T01",
      ]),
    );
    expect(result).not.toContain("PROC F-02");
  });

  it("改名は直接の参照元だけに伝える", () => {
    expect(keys(change("rename"))).toEqual([
      "MOD api/routes/chats.py",
      "PROC F-02",
      "LOGIC ChatService.send_message",
      "CC トランザクション",
      "TASK M-02-T01",
      "UNIT M-02-T01",
    ]);
  });

  it("テーブルの変更は、それを使う CRUD・手順の処理に届く", () => {
    const tableChange: Change = { id: "t", title: "", key: "TABLE chats", kind: "content", before: "", after: "" };

    expect(keys(tableChange)).toEqual(
      expect.arrayContaining(["F-02", "CRUD F-02×chats", "PROC F-02", "LOGIC ChatService.send_message", "UNIT M-02-T01"]),
    );
  });

  it("同じ要素に複数の道があれば短い方を残し、変わった要素そのものは含めない", () => {
    const elements: DesignElement[] = [
      { key: "A", kind: "requirement", stage: 0, label: "", refs: [] },
      { key: "S", kind: "screen", stage: 0, label: "", refs: [{ to: "A", edge: "requirement" }] },
      {
        key: "F",
        kind: "function",
        stage: 1,
        label: "",
        refs: [
          { to: "S", edge: "screen" },
          { to: "A", edge: "requirement" },
        ],
      },
    ];
    const result = impactOf(elements, { id: "a", title: "", key: "A", kind: "content", before: "", after: "" });

    expect(result.map((i) => [i.key, i.path.length])).toEqual([
      ["S", 2],
      ["F", 2],
    ]);
  });
});

describe("段階の印と承認し直し", () => {
  it("今の仕組みの「古い」は、文書の変更なら全段階、段階 N の変更なら N より後ろ", () => {
    expect(outdatedStages(0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(outdatedStages(4)).toEqual([5, 6, 7, 8]);
  });

  it("古い段階の中の見直しが要る要素を数え、すべて確認済みなら承認し直せる", () => {
    const c = change("rename");
    const items = impactOf(DEMO_ELEMENTS, c);
    const before = stageMarks(DEMO_ELEMENTS, c, items, new Set());
    const after = stageMarks(DEMO_ELEMENTS, c, items, new Set(["PROC F-02"]));

    // 同じ段階の中の依存(段階4)は、段階が古くならなくても印が付く
    expect(before[3]).toEqual({ stage: 4, outdated: false, open: 1, reviewed: 0 });
    expect(canReapprove(before[4])).toBe(false);
    expect(after[4]).toEqual({ stage: 5, outdated: true, open: 0, reviewed: 1 });
    expect(canReapprove(after[4])).toBe(true);
    // 古くない段階は承認し直す対象ではない
    expect(canReapprove(before[3])).toBe(false);
  });

  it("見直す要素の無い古い段階は、そのまま承認し直せる", () => {
    const c = change("fr");
    const marks = stageMarks(DEMO_ELEMENTS, c, impactOf(DEMO_ELEMENTS, c), new Set());

    // FR-011 の変更で全段階が古くなるが、段階4(モジュール)には見直す要素が無い
    expect(marks[3]).toEqual({ stage: 4, outdated: true, open: 0, reviewed: 0 });
    expect(canReapprove(marks[3])).toBe(true);
  });
});

describe("regenerationTargets", () => {
  it("部分再生成できる段階(5・6・8)の要素だけを候補にする", () => {
    const items = impactOf(DEMO_ELEMENTS, change("fr"));

    expect(regenerationTargets(DEMO_ELEMENTS, items)).toEqual([
      { stage: 5, key: "PROC F-02" },
      { stage: 6, key: "LOGIC ChatService.send_message" },
      { stage: 8, key: "UNIT M-02-T01" },
    ]);
  });
});
