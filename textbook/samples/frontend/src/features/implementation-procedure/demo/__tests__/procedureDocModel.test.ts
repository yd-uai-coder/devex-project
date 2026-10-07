// 作成：Phase-25-2｜更新：Phase-25-5
import { describe, expect, it } from "vitest";
import { DEMO_CONTEXT, DEMO_FINDINGS, DEMO_SOURCES, DEMO_UNITS } from "../demoData";
import {
  countBySeverity,
  expandRef,
  findingsOf,
  sortFindings,
  sortUnitsByDependency,
  toAiMarkdown,
  toUnitMarkdown,
  unresolvedRefs,
  type Finding,
  type Unit,
} from "../procedureDocModel";

const unit = (id: string, dependsOn: string[] = []): Unit => ({
  id,
  kind: "feature",
  milestone: "M-01",
  title: id,
  functionIds: [],
  dependsOn,
  detail: null,
});

const finding = (severity: Finding["severity"], unitId: string | null, message: string = severity): Finding => ({
  severity,
  source: "ai",
  unitId,
  target: "対象",
  message,
  stage: 1,
});

describe("sortUnitsByDependency", () => {
  it("依存先がそろった単位から元の順で取り、依存される単位を先に並べる", () => {
    const { order, issues } = sortUnitsByDependency([unit("C", ["B"]), unit("A"), unit("B", ["A"]), unit("D")]);

    expect(order.map((u) => u.id)).toEqual(["A", "B", "D", "C"]);
    expect(issues).toEqual([]);
  });

  it("一覧に無い依存先と循環を指摘し、循環した単位は末尾に残す", () => {
    const { order, issues } = sortUnitsByDependency([unit("A", ["Z"]), unit("B", ["C"]), unit("C", ["B"])]);

    expect(order.map((u) => u.id)).toEqual(["A", "B", "C"]);
    expect(issues).toEqual(["A: 依存先 Z が単位の一覧に無い", "依存が循環している: B, C"]);
  });

  it("デモのデータは循環せず、どの単位も依存先より後ろに来る", () => {
    const { order, issues } = sortUnitsByDependency(DEMO_UNITS);
    const position = new Map(order.map((u, i) => [u.id, i]));

    expect(issues).toEqual([]);
    for (const u of order) {
      for (const dep of u.dependsOn) expect(position.get(dep)!).toBeLessThan(position.get(u.id)!);
    }
  });
});

describe("指摘の集計", () => {
  it("単位ごとに絞り、重要度ごとに数え、最重要から並べる", () => {
    const findings = [finding("minor", "U"), finding("critical", "U"), finding("major", null), finding("critical", "U", "2件目")];

    expect(findingsOf(findings, null)).toHaveLength(1);
    expect(countBySeverity(findingsOf(findings, "U"))).toEqual({ critical: 2, major: 0, minor: 1 });
    expect(sortFindings(findingsOf(findings, "U")).map((f) => f.message)).toEqual(["critical", "2件目", "minor"]);
  });
});

describe("参照の解決と展開", () => {
  it("設計に無い参照(段階5で選んでいない F-01)を見つける", () => {
    const signup = DEMO_UNITS.find((u) => u.id === "M-01-T02")!;

    expect(unresolvedRefs(signup.detail!.refs, DEMO_SOURCES)).toEqual([{ kind: "procedure", key: "F-01" }]);
    expect(expandRef({ kind: "procedure", key: "F-01" }, DEMO_SOURCES)).toBeNull();
  });

  it("手順は表に、関数の詳細は項目の表と疑似コードに展開する", () => {
    const procedure = expandRef({ kind: "procedure", key: "F-07" }, DEMO_SOURCES)!;
    const logic = expandRef({ kind: "logic", key: "L-01" }, DEMO_SOURCES)!;

    expect(procedure).toContain("### 段階5 F-07 チャットメッセージを送信する");
    expect(procedure).toContain("| 1a | — | — | — | リクエストパラメータまたは認証の検証に失敗した場合 |");
    expect(logic).toContain("| シグネチャ | async def stream_chat(self, id: str, message: str) -> AsyncGenerator[str, None] |");
    expect(logic).toContain("4. SSEフォーマットに変換しながらレスポンスを順次生成する");
  });
});

describe("md の組み立て", () => {
  const chat = DEMO_UNITS.find((u) => u.id === "M-03-T01")!;
  const chatFindings = findingsOf(DEMO_FINDINGS, "M-03-T01");

  it("人向けの md は参照を ID で書き、中身を展開しない", () => {
    const md = toUnitMarkdown(chat, chatFindings, DEMO_SOURCES);

    expect(md).toContain("- 段階5 F-07 チャットメッセージを送信する");
    expect(md).not.toContain("| No | 呼び出し元 → 呼び出し先 |");
    expect(md).toContain("- [最重要][AI] F-07#1〜#4 / 段階4 repositories/project_repository.py: チャット履歴を");
  });

  it("AI 向けの md は参照を展開し、未定義が残っていれば先頭で警告する", () => {
    const md = toAiMarkdown(chat, chatFindings, DEMO_SOURCES, DEMO_CONTEXT);

    expect(md.startsWith("> ⚠ この単位には「未定義・要決定」が 8 件残っています(最重要 3 件)。")).toBe(true);
    expect(md).toContain("| No | 呼び出し元 → 呼び出し先 |");
    expect(md).toContain("- 07章 **認証**: 認証にはJWTを使用し");
    expect(toAiMarkdown(chat, [], DEMO_SOURCES, DEMO_CONTEXT).startsWith("あなたは実装担当者です。")).toBe(true);
  });

  // Phase-25-5:追記
  it("手順を参照する単位には、手順から導いたシーケンス図(Mermaid)と、図にするときの指摘を入れる", () => {
    const base = DEMO_UNITS.find((u) => u.id === "M-01-T01")!;
    const md = toUnitMarkdown(chat, chatFindings, DEMO_SOURCES);

    expect(md).toContain("### シーケンス図(段階5 F-07 の手順から導出)\n\n```mermaid\nsequenceDiagram");
    expect(md).toContain("- 検証 F-07#1: 分岐「3a へ」の行が無い");
    expect(toAiMarkdown(chat, chatFindings, DEMO_SOURCES, DEMO_CONTEXT)).toContain("```mermaid");
    expect(toUnitMarkdown(base, [], DEMO_SOURCES)).not.toContain("```mermaid");
  });

  it("未生成の単位は、人向けは見出しだけ、AI 向けは空にする", () => {
    const login = DEMO_UNITS.find((u) => u.id === "M-01-T03")!;

    expect(toUnitMarkdown(login, [], DEMO_SOURCES)).toContain("(手順書は未生成)");
    expect(toAiMarkdown(login, [], DEMO_SOURCES, DEMO_CONTEXT)).toBe("");
  });
});
