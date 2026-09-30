// 作成：Phase-11-4
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isGenerating, useUmlStore } from "../uml-store";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { makeCandidates, makeDiagram, makeRun } from "@/features/uml/test-utils/umlFixtures";

const INITIAL = useUmlStore.getState();

describe("useUmlStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    useUmlStore.setState(INITIAL, true);
  });

  afterEach(() => {
    stub.restore();
  });

  it("fetchAll は図の一覧・候補・生成履歴をまとめて取得する", async () => {
    stub.queue({ body: [makeDiagram()] });
    stub.queue({ body: makeCandidates() });
    stub.queue({ body: [makeRun()] });

    await useUmlStore.getState().fetchAll("p1");

    const state = useUmlStore.getState();
    expect(state.status).toBe("success");
    expect(state.diagrams).toHaveLength(1);
    expect(state.candidates?.dfd_subjects).toHaveLength(2);
    expect(state.runs).toHaveLength(1);
    expect(stub.requests).toHaveLength(3);
  });

  it("fetchAll はキャッシュが新しければ再取得しないが、別プロジェクトなら取得する", async () => {
    useUmlStore.setState({ projectId: "p1", fetchedAt: Date.now() });

    await useUmlStore.getState().fetchAll("p1");
    expect(stub.requests).toHaveLength(0);

    await useUmlStore.getState().fetchAll("p2");
    expect(stub.requests[0].url).toContain("/projects/p2/uml/");
  });

  it("generate は受け付け後に図の一覧と生成履歴を取り直す", async () => {
    stub.queue({ status: 202, body: makeRun({ status: "running", results: [] }) });
    stub.queue({ body: [makeDiagram({ generation_status: "generating" })] });
    stub.queue({ body: [makeRun({ status: "running", results: [] })] });

    await useUmlStore.getState().generate("p1", { notation: "component", subjects: [] });

    expect(stub.requests[0].init?.method).toBe("POST");
    expect(isGenerating(useUmlStore.getState().diagrams)).toBe(true);
    expect(useUmlStore.getState().submitting).toBe(false);
  });

  it("generate の受け付けエラーは generateError に detail を入れる", async () => {
    stub.queue({
      status: 409,
      body: { detail: "生成中の図があります", code: "UML_GENERATION_IN_PROGRESS" },
    });

    await useUmlStore.getState().generate("p1", { notation: "component", subjects: [] });

    expect(useUmlStore.getState().generateError).toBe("生成中の図があります");
    expect(stub.requests).toHaveLength(1);
  });
});
