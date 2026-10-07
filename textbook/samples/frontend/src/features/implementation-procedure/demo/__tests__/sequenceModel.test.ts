// 作成：Phase-25-5
import { describe, expect, it } from "vitest";
import { DEMO_SOURCES } from "../demoData";
import type { ModuleSource, ProcedureSource, ProcedureStep } from "../procedureDocModel";
import {
  reachableCallees,
  stubsOutsideSequence,
  sutParticipant,
  toMermaid,
  toSequence,
  type SequenceMessage,
} from "../sequenceModel";

const step = (no: string, route: string, call = "", extra: Partial<ProcedureStep> = {}): ProcedureStep => ({
  no,
  route,
  call,
  data: "",
  action: "",
  result: `r${no}`,
  db: "—",
  branch: "—",
  ...extra,
});
const proc = (steps: ProcedureStep[]): ProcedureSource => ({ id: "F-01", name: "", trigger: "POST /x", steps });
const mod = (path: string, dependsOn: string[]): ModuleSource => ({ path, layer: "", responsibility: "", dependsOn });
const MODULES = {
  "a/route.py": mod("a/route.py", ["a/service.py"]),
  "a/service.py": mod("a/service.py", ["a/repo.py"]),
  "a/repo.py": mod("a/repo.py", []),
};
const messages = (events: ReturnType<typeof toSequence>["events"]) =>
  events.filter((e): e is SequenceMessage => e.type === "message").map((e) => `${e.from}${e.kind === "return" ? "-->" : "->"}${e.to}:${e.stepId}`);

describe("toSequence", () => {
  it("入れ子の呼び出しを推測し、戻りを内側から順に足す", () => {
    const seq = toSequence(
      proc([step("1", "利用者 → a/route.py", "post"), step("2", "a/route.py → a/service.py", "run"), step("3", "a/service.py → a/repo.py", "save")]),
      MODULES,
    );

    expect(seq.participants.map((p) => p.name)).toEqual(["利用者", "a/route.py", "a/service.py", "a/repo.py"]);
    expect(messages(seq.events)).toEqual([
      "P1->P2:F-01#1",
      "P2->P3:F-01#2",
      "P3->P4:F-01#3",
      "P4-->P3:F-01#3",
      "P3-->P2:F-01#2",
      "P2-->P1:F-01#1",
    ]);
    expect(seq.issues).toEqual([]);
  });

  it("呼び出し元へ戻る行は戻りとして描いて指摘し、無い分岐先と依存先に無い呼び出しも指摘する", () => {
    const seq = toSequence(
      proc([
        step("1", "利用者 → a/route.py", "post", { branch: "3a へ" }),
        step("1a", "—"),
        step("2", "a/route.py → a/repo.py", "load"),
        step("3", "a/repo.py → 利用者"),
      ]),
      MODULES,
    );

    expect(seq.issues.map((i) => i.stepId)).toEqual(["F-01#1", "F-01#2", "F-01#3"]);
    expect(seq.issues[0].message).toBe("分岐「3a へ」の行が無い");
    expect(seq.issues[1].message).toContain("依存先(段階4)に無い");
    expect(messages(seq.events)).toEqual(["P1->P2:F-01#1", "P2->P3:F-01#2", "P3-->P2:F-01#2", "P2-->P1:F-01#3"]);
    expect(seq.events.find((e) => e.type === "note")).toMatchObject({ stepId: "F-01#1a", over: ["P1", "P2"] });
  });

  it("非同期の呼び出しは戻りを待たない(種別があれば使う)", () => {
    const seq = toSequence(
      proc([step("1", "a/route.py → a/service.py", "run"), step("2", "a/service.py → a/repo.py", "job", { kind: "async" })]),
      MODULES,
    );

    expect(seq.events.filter((e) => e.type === "message").map((e) => (e as SequenceMessage).kind)).toEqual([
      "call",
      "async",
      "return",
    ]);
  });

  it("デモの F-07: ai_service → frontend を戻りとして描き、無い分岐先を指摘する", () => {
    const seq = toSequence(DEMO_SOURCES.procedures["F-07"], DEMO_SOURCES.modules);

    expect(seq.issues.map((i) => i.stepId)).toEqual(["F-07#1", "F-07#4"]);
    const last = seq.events.filter((e): e is SequenceMessage => e.type === "message").at(-1)!;
    expect(last).toMatchObject({ stepId: "F-07#4", kind: "return", derived: false, label: "SSEストリーミングデータ" });
    expect(seq.participants.find((p) => p.id === last.from)!.name).toBe("api/routes/projects.py");
  });
});

describe("スタブの候補と Mermaid", () => {
  const seq = toSequence(DEMO_SOURCES.procedures["F-07"], DEMO_SOURCES.modules);
  const nameOf = (id: string) => seq.participants.find((p) => p.id === id)!.name;

  it("SUT を関数名かトリガーで参加者に対応させ、そこから呼ぶ先をスタブの候補にする", () => {
    const service = sutParticipant(seq, "AIservice.stream_chat", "POST /api/v1/projects/{id}/chat")!;
    const route = sutParticipant(seq, "POST /api/v1/projects/{id}/chat", "POST /api/v1/projects/{id}/chat")!;

    expect(nameOf(service)).toBe("services/ai_service.py");
    expect(reachableCallees(seq, service).map(nameOf)).toEqual(["external/gemini_client.py"]);
    expect(reachableCallees(seq, route).map(nameOf)).toEqual(["services/ai_service.py", "external/gemini_client.py"]);
    expect(sutParticipant(seq, "無い関数", "POST /x")).toBeNull();
  });

  it("スタブの欄が、図の候補の外のモジュール(手順に無い依存)を挙げていれば返す", () => {
    const paths = Object.keys(DEMO_SOURCES.modules);
    const candidates = ["external/gemini_client.py"];

    expect(
      stubsOutsideSequence("GeminiClient・project_repository をフェイク。外部 API と DB に依存せず", candidates, paths),
    ).toEqual(["repositories/project_repository.py"]);
    expect(stubsOutsideSequence("GeminiClient だけをフェイク", candidates, paths)).toEqual([]);
  });

  it("Mermaid は別名の参加者・手順番号・戻りの破線・分岐の注記で書く", () => {
    const text = toMermaid(seq);

    expect(text.split("\n")[0]).toBe("sequenceDiagram");
    expect(text).toContain("  participant P1 as frontend");
    expect(text).toContain("  P2->>P3: 2: AIservice.stream_chat(プロジェクトID(id), チャットメッセージ)");
    expect(text).toContain("  P4-->>P3: (3 の戻り) 対話ストリーミングデータ");
    expect(text).toContain("  Note over P1,P2: 1a リクエストパラメータまたは認証の検証に失敗した場合 → ValidationError → 400");
    expect(text).not.toContain("#");
  });
});
