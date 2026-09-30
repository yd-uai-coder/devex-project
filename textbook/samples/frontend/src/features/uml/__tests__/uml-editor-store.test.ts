// 作成：Phase-11-5｜更新：Phase-11-6,12-5
// Phase-11-6:追記 ── umlFixtures(DFD_MODEL, ER_MODEL), reactFlowAdapter.placeMissingNodes
// Phase-12-5:追記 ── vitest.vi, @/lib/api/download(saveFile をスパイする)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUmlEditorStore } from "../uml-editor-store";
import * as download from "@/lib/api/download";
import { stubFetch } from "@/lib/api/test-utils/fetch-stub";
import { placeMissingNodes } from "@/features/uml/adapters/reactFlowAdapter";
import {
  COMPONENT_LAYOUT,
  DATA_ITEM,
  DFD_MODEL,
  ER_MODEL,
  makeDiagram,
} from "@/features/uml/test-utils/umlFixtures";

const INITIAL = useUmlEditorStore.getState();

describe("useUmlEditorStore", () => {
  let stub: ReturnType<typeof stubFetch>;

  beforeEach(() => {
    stub = stubFetch();
    useUmlEditorStore.setState(INITIAL, true);
  });

  afterEach(() => {
    stub.restore();
  });

  async function loadDiagram(diagram = makeDiagram()) {
    stub.queue({ body: diagram });
    stub.queue({ body: [DATA_ITEM] });
    await useUmlEditorStore.getState().load("p1", "d1");
  }

  it("load は図とデータ辞書を取得し、配置のある図では自動レイアウトを呼ばない", async () => {
    await loadDiagram();

    const state = useUmlEditorStore.getState();
    expect(state.status).toBe("success");
    expect(state.layout).toEqual(COMPONENT_LAYOUT);
    expect(state.dataItems).toEqual([DATA_ITEM]);
    expect(stub.requests).toHaveLength(2);
  });

  it("load は配置が null の図で自動レイアウトを1回実行する(M6 の初回)", async () => {
    stub.queue({ body: makeDiagram({ layout_model: null }) });
    stub.queue({ body: [] });
    stub.queue({ body: makeDiagram() });

    await useUmlEditorStore.getState().load("p1", "d1");

    expect(stub.requests[2].url).toMatch(/\/diagrams\/d1\/layout$/);
    expect(useUmlEditorStore.getState().layout).toEqual(COMPONENT_LAYOUT);
  });

  it("自動レイアウトできないときは格子配置のまま理由を表示する", async () => {
    stub.queue({ body: makeDiagram({ layout_model: null }) });
    stub.queue({ body: [] });
    stub.queue({
      status: 400,
      body: { detail: "要素数が上限(30)を超えています", code: "LAYOUT_NODE_LIMIT_EXCEEDED" },
    });

    await useUmlEditorStore.getState().load("p1", "d1");

    const state = useUmlEditorStore.getState();
    expect(state.layoutNotice).toContain("要素数が上限(30)を超えています");
    expect(Object.keys(state.layout?.nodes ?? {})).toEqual(["c1", "c2"]);
    expect(state.error).toBeNull();
  });

  it("moveNodes は位置を配置へ戻して dirty にし、save は意味モデルと配置を同じ version で送る", async () => {
    await loadDiagram();
    useUmlEditorStore.getState().moveNodes({ c2: { x: 300, y: 200 } });
    expect(useUmlEditorStore.getState().dirty).toBe(true);
    stub.queue({ body: makeDiagram({ version: 2 }) });

    const ok = await useUmlEditorStore.getState().save();

    const body = JSON.parse(stub.requests[2].init?.body as string);
    expect(ok).toBe(true);
    expect(stub.requests[2].init?.method).toBe("PUT");
    expect(body.version).toBe(1);
    expect(body.layout_model.nodes.c2).toMatchObject({ x: 300, y: 200 });
    expect(body.layout_model.edges.r1.points).toEqual([]);
    expect(useUmlEditorStore.getState()).toMatchObject({ dirty: false, saving: false });
    expect(useUmlEditorStore.getState().diagram?.version).toBe(2);
  });

  it("save が 409 VERSION_CONFLICT なら conflict を立てる", async () => {
    await loadDiagram();
    stub.queue({ status: 409, body: { detail: "conflict", code: "VERSION_CONFLICT" } });

    const ok = await useUmlEditorStore.getState().save();

    expect(ok).toBe(false);
    expect(useUmlEditorStore.getState().conflict).toBe(true);
    expect(useUmlEditorStore.getState().error).toBeNull();
  });

  it("runLayout は未保存の変更を先に保存してから配置する", async () => {
    await loadDiagram();
    useUmlEditorStore.getState().moveNodes({ c2: { x: 300, y: 200 } });
    stub.queue({ body: makeDiagram({ version: 2 }) });
    stub.queue({ body: makeDiagram({ version: 2 }) });

    await useUmlEditorStore.getState().runLayout();

    expect(stub.requests.slice(2).map((r) => r.init?.method)).toEqual(["PUT", "POST"]);
    expect(stub.requests[3].url).toMatch(/\/layout$/);
    expect(useUmlEditorStore.getState().layout).toEqual(COMPONENT_LAYOUT);
  });

  // Phase-11-6:追記
  describe("編集アクション", () => {
    it("addElement は要素を追加して選択し、配置を補って dirty にする", async () => {
      await loadDiagram();

      useUmlEditorStore.getState().addElement();

      const state = useUmlEditorStore.getState();
      expect(state.selection).toEqual({ kind: "element", id: "c3" });
      expect(state.layout?.nodes.c3).toBeDefined();
      expect(state.dirty).toBe(true);
    });

    it("deleteElement はつながる関係ごと消し、その座標と折れ点も配置から除く", async () => {
      await loadDiagram();
      useUmlEditorStore.getState().select({ kind: "element", id: "c2" });

      useUmlEditorStore.getState().deleteElement("c2");

      const state = useUmlEditorStore.getState();
      expect(state.model?.relations).toEqual([]);
      expect(state.layout?.nodes.c2).toBeUndefined();
      expect(state.layout?.edges.r1).toBeUndefined();
      expect(state.selection).toBeNull();
    });

    it("編集すると古くなった検証結果を捨てる", async () => {
      await loadDiagram();
      useUmlEditorStore.setState({ validation: { errors: [], warnings: [] } });

      useUmlEditorStore.getState().updateElement("c1", { name: "認証" });

      expect(useUmlEditorStore.getState().validation).toBeNull();
      expect(useUmlEditorStore.getState().model?.elements[0].name).toBe("認証");
    });

    it("DFD の線はデータ項目が無ければ追加せず false を返し、あれば先頭の項目で追加する", async () => {
      await loadDiagram(
        makeDiagram({
          notation: "dfd",
          semantic_model: DFD_MODEL,
          layout_model: placeMissingNodes(DFD_MODEL, null),
        }),
      );
      useUmlEditorStore.setState({ dataItems: [] });
      expect(useUmlEditorStore.getState().addRelation("p1", "s1")).toBe(false);

      useUmlEditorStore.setState({ dataItems: [DATA_ITEM] });
      expect(useUmlEditorStore.getState().addRelation("p1", "s1")).toBe(true);
      expect(useUmlEditorStore.getState().model?.relations.at(-1)).toMatchObject({
        id: "f3",
        data_item_id: DATA_ITEM.id,
      });
    });

    it("ER のカラムを追加・更新・削除する", async () => {
      await loadDiagram(
        makeDiagram({
          notation: "er",
          semantic_model: ER_MODEL,
          layout_model: placeMissingNodes(ER_MODEL, null),
        }),
      );
      const store = useUmlEditorStore.getState();

      store.addColumn("t1");
      store.updateColumn("t1", 1, { name: "email" });
      store.deleteColumn("t1", 0);

      const table = useUmlEditorStore.getState().model?.elements[0];
      expect(table && "columns" in table ? table.columns.map((c) => c.name) : []).toEqual(["email"]);
    });

    it("validate は未保存の変更を先に保存してから検証する", async () => {
      await loadDiagram();
      useUmlEditorStore.getState().updateElement("c1", { name: "認証" });
      stub.queue({ body: makeDiagram({ version: 2 }) });
      stub.queue({
        body: {
          errors: [{ code: "DUPLICATE_ID", message: "重複", element_id: "c1" }],
          warnings: [],
        },
      });

      await useUmlEditorStore.getState().validate();

      expect(stub.requests.slice(2).map((r) => r.init?.method)).toEqual(["PUT", "POST"]);
      expect(stub.requests[3].url).toMatch(/\/validate$/);
      expect(useUmlEditorStore.getState().validation?.errors).toHaveLength(1);
    });
  });

  // Phase-12-5:追記 ── 承認・出力
  describe("承認と出力", () => {
    it("approve は未保存の変更を先に保存し、保存後の version で承認する", async () => {
      await loadDiagram();
      useUmlEditorStore.getState().updateElement("c1", { name: "認証" });
      stub.queue({ body: makeDiagram({ version: 2, status: "reviewing" }) });
      stub.queue({ body: makeDiagram({ version: 2, status: "approved" }) });

      await useUmlEditorStore.getState().approve();

      expect(stub.requests.slice(2).map((r) => r.init?.method)).toEqual(["PUT", "POST"]);
      expect(stub.requests[3].url).toMatch(/\/diagrams\/d1\/approve$/);
      expect(JSON.parse(stub.requests[3].init?.body as string)).toEqual({ version: 2 });
      expect(useUmlEditorStore.getState().diagram?.status).toBe("approved");
      expect(useUmlEditorStore.getState().approving).toBe(false);
    });

    it("検証エラーで承認できなければ、理由を出して検証パネルに一覧を取る", async () => {
      await loadDiagram();
      stub.queue({
        status: 400,
        body: {
          detail: "検証エラーが1件あるため承認できません",
          code: "UML_APPROVAL_VALIDATION_FAILED",
        },
      });
      stub.queue({
        body: { errors: [{ code: "DUPLICATE_ID", message: "重複", element_id: "c1" }], warnings: [] },
      });

      await useUmlEditorStore.getState().approve();

      const state = useUmlEditorStore.getState();
      expect(state.error).toBe("検証エラーが1件あるため承認できません");
      expect(stub.requests[3].url).toMatch(/\/validate$/);
      expect(state.validation?.errors).toHaveLength(1);
      expect(state.diagram?.status).toBe("draft");
    });

    it("承認で version が合わなければ競合として扱う", async () => {
      await loadDiagram();
      stub.queue({ status: 409, body: { detail: "conflict", code: "VERSION_CONFLICT" } });

      await useUmlEditorStore.getState().approve();

      expect(useUmlEditorStore.getState().conflict).toBe(true);
    });

    it("exportDiagram はファイルを保存させ、図を取り直して出力済みにする", async () => {
      const saveFile = vi.spyOn(download, "saveFile").mockImplementation(() => {});
      await loadDiagram(makeDiagram({ status: "approved" }));
      const fetchMock = stub.fetchMock;
      fetchMock.mockResolvedValueOnce(
        new Response("<svg/>", {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="component.svg"' },
        }),
      );
      stub.queue({ body: makeDiagram({ status: "exported" }) });

      await useUmlEditorStore.getState().exportDiagram("svg");

      expect(saveFile).toHaveBeenCalledWith("component.svg", "<svg/>", "image/svg+xml");
      // 出力の応答は mockResolvedValueOnce で差し込んだため stub.requests には記録されない
      expect(String(fetchMock.mock.calls[2][0])).toMatch(/\/diagrams\/d1\/export\/svg$/);
      expect(useUmlEditorStore.getState().diagram?.status).toBe("exported");
      saveFile.mockRestore();
    });
  });
});
